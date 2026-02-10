/**
 * Runware webhook handler + background result processing.
 * Owns the full webhook flow: parse request → call DO → fetch from CDN → store in R2 → write to D1.
 */

import * as schema from '@ig/db/schema'
import { drizzle } from 'drizzle-orm/d1'
import { Hono } from 'hono'
import { v7 as uuidv7 } from 'uuid'

import type { Context } from '../../context'
import { fetchError, projectionError, storageError } from './errors'
import { getContentType } from './schemas'
import { getGenerationStub } from './stub'
import type { GenerationMeta, Output, OutputResult, OutputSuccess, PendingItem } from './types'

export const webhook = new Hono<{ Bindings: Env }>()

webhook.post('/', async (c) => {
  const generationId = c.req.query('generation_id')
  if (!generationId) {
    console.error('runware_webhook_missing_generation_id')
    return c.body(null, 400)
  }

  let payload: unknown
  try {
    payload = await c.req.json()
  } catch {
    console.error('runware_webhook_invalid_json')
    return c.body(null, 400)
  }

  const ctx: Context = { env: c.env, headers: c.req.raw.headers }
  const stub = getGenerationStub(ctx, generationId)
  const result = await stub.recordWebhook(payload)

  // Process results in background — don't block Runware's webhook
  if (result.items.length > 0) {
    c.executionCtx.waitUntil(
      processWebhookResults(ctx, {
        generationId,
        meta: result.meta,
        items: result.items,
      }),
    )
  }

  return c.body(null, 200)
})

// -- Background processing (runs in waitUntil) --

type ProcessArgs = {
  generationId: string
  meta: GenerationMeta
  items: PendingItem[]
}

async function processWebhookResults(ctx: Context, args: ProcessArgs) {
  const { generationId, meta, items } = args
  const contentType = getContentType(meta.outputFormat)
  const now = Date.now()

  const results: OutputResult[] = []
  for (const item of items) {
    const result = await processItem(ctx, { item, contentType, now })
    results.push(result)
  }

  // Report results back to the DO
  const stub = getGenerationStub(ctx, generationId)
  const { complete } = await stub.confirmOutputs(results)

  // If all outputs received, write to D1
  if (complete) {
    const state = await stub.getState()
    if (state) await persistToD1(ctx, { generationId, meta, state })
  }
}

async function processItem(
  ctx: Context,
  args: { item: PendingItem; contentType: string; now: number },
): Promise<OutputResult> {
  const { item, contentType, now } = args

  // Fetch from Runware CDN
  const response = await fetch(item.imageURL)
  if (!response.ok) {
    return fetchError(item.imageURL, response.status, await response.text(), item.raw, now)
  }

  // Stream to R2
  const id = uuidv7()
  const r2Key = `generations/${id}`

  try {
    await ctx.env.GENERATIONS_BUCKET.put(r2Key, response.body, {
      httpMetadata: { contentType },
    })
  } catch (err) {
    return storageError(r2Key, err, item.raw, now)
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
  ctx: Context,
  args: {
    generationId: string
    meta: GenerationMeta
    state: { outputs: Output[]; completedAt?: number }
  },
) {
  const { generationId, meta, state } = args
  const successes = state.outputs.filter((o: Output): o is OutputSuccess => o.type === 'success')
  const db = drizzle(ctx.env.DB, { schema })

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
    console.error('D1 projection failed', { generationId, error: err })
    const stub = getGenerationStub(ctx, generationId)
    await stub.setError(projectionError(err))
  }
}
