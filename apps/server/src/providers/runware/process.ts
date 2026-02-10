/**
 * Process webhook results at the Worker level.
 * Fetches images from Runware CDN, stores in R2, writes to D1.
 * Called from waitUntil — does not block the webhook response.
 */

import * as schema from '@ig/db/schema'
import { drizzle } from 'drizzle-orm/d1'
import { v7 as uuidv7 } from 'uuid'

import { serializeError } from '../../utils/error'
import type {
  GenerationMeta,
  Output,
  OutputError,
  OutputResult,
  OutputSuccess,
  PendingItem,
} from './generationDo'
import { getContentType } from './schemas'

type ProcessArgs = {
  generationId: string
  meta: GenerationMeta
  items: PendingItem[]
}

export async function processWebhookResults(env: Env, args: ProcessArgs) {
  const { generationId, meta, items } = args
  const contentType = getContentType(meta.outputFormat)
  const now = Date.now()

  // Process each pending item: fetch from CDN, store in R2
  const results: OutputResult[] = []

  for (const item of items) {
    const result = await processItem(env, item, contentType, now)
    results.push(result)
  }

  // Report results back to the DO
  // biome-ignore lint: env type cast needed to break circular depth
  const ns = (env as any).GENERATION_DO
  const stub = ns.get(ns.idFromName(generationId))
  const { complete } = await stub.confirmOutputs(results)

  // If all outputs received, write to D1
  if (complete) {
    const state = await stub.getState()
    if (state) await persistToD1(env, generationId, meta, state)
  }
}

async function processItem(
  env: Env,
  item: PendingItem,
  contentType: string,
  now: number,
): Promise<OutputResult> {
  // Fetch from Runware CDN
  const response = await fetch(item.imageURL)
  if (!response.ok) {
    return {
      type: 'error',
      error: {
        code: 'fetch_failed',
        url: item.imageURL,
        status: response.status,
        body: await response.text(),
      },
      raw: item.raw,
      createdAt: now,
    } satisfies OutputError
  }

  // Stream to R2
  const id = uuidv7()
  const r2Key = `generations/${id}`

  try {
    await env.GENERATIONS_BUCKET.put(r2Key, response.body, {
      httpMetadata: { contentType },
    })
  } catch (err) {
    return {
      type: 'error',
      error: { code: 'storage_failed', r2Key, cause: serializeError(err) },
      raw: item.raw,
      createdAt: now,
    } satisfies OutputError
  }

  return {
    type: 'success',
    id,
    r2Key,
    contentType,
    seed: item.seed,
    cost: item.cost,
    metadata: item.raw,
    createdAt: now,
  } satisfies OutputSuccess
}

/** Write completed generation and artifacts to D1. */
async function persistToD1(
  env: Env,
  generationId: string,
  meta: GenerationMeta,
  state: { outputs: Output[]; completedAt?: number },
) {
  const successes = state.outputs.filter((o: Output): o is OutputSuccess => o.type === 'success')
  const db = drizzle(env.DB, { schema })

  try {
    await db.insert(schema.runwareGenerations).values({
      id: generationId,
      model: meta.model,
      input: meta.input,
      artifactCount: successes.length,
      createdAt: new Date(meta.createdAt),
      completedAt: new Date(state.completedAt!),
    })

    for (const output of successes) {
      await db.insert(schema.runwareArtifacts).values({
        id: output.id,
        generationId,
        model: meta.model,
        r2Key: output.r2Key,
        contentType: output.contentType,
        seed: output.seed,
        cost: output.cost,
        metadata: output.metadata,
        createdAt: new Date(output.createdAt),
      })
    }
  } catch (err) {
    const cause = err instanceof Error ? err.cause : undefined
    console.error('D1 projection failed', { generationId, error: err, cause })
  }
}
