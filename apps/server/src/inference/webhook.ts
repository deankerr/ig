/**
 * Runware webhook handler + background artifact processing.
 * Owns the full webhook flow: parse request → call DO → fetch from CDN → store in R2 → write to D1.
 */

import * as schema from '@ig/db/schema'
import { drizzle } from 'drizzle-orm/d1'
import { Hono } from 'hono'
import { v7 as uuidv7 } from 'uuid'

import type { Context } from '../context'
import { getRequest, type PendingItem, type RequestMeta } from './request'
import {
  output,
  projectionError,
  type Output,
  type OutputResult,
  type OutputSuccess,
} from './result'
import { getContentType } from './schema'

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
  const request = getRequest(ctx, generationId)
  const result = await request.recordWebhook(payload)

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
  meta: RequestMeta
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

  const request = getRequest(ctx, generationId)
  const { complete } = await request.confirmOutputs(results)

  if (complete) {
    const state = await request.getState()
    if (state) await persistToD1(ctx, { generationId, meta, state })
  }
}

async function processItem(
  ctx: Context,
  args: { item: PendingItem; contentType: string; now: number },
): Promise<OutputResult> {
  const { item, contentType, now } = args

  const response = await fetch(item.imageURL)
  if (!response.ok) {
    return output.fetchError(item.imageURL, response.status, await response.text(), item.raw, now)
  }

  const id = uuidv7()
  const r2Key = `generations/${id}`

  try {
    await ctx.env.GENERATIONS_BUCKET.put(r2Key, response.body, {
      httpMetadata: { contentType },
    })
  } catch (err) {
    return output.storageError(r2Key, err, item.raw, now)
  }

  return output.success({
    id,
    r2Key,
    contentType,
    seed: item.seed,
    cost: item.cost,
    metadata: item.raw,
    createdAt: now,
  })
}

/** Write completed generation and artifacts to D1. */
async function persistToD1(
  ctx: Context,
  args: {
    generationId: string
    meta: RequestMeta
    state: { outputs: Output[]; completedAt?: number }
  },
) {
  const { generationId, meta, state } = args
  const successes = state.outputs.filter((o: Output): o is OutputSuccess => o.type === 'success')
  const db = drizzle(ctx.env.DB, { schema })

  // Extract dimensions from generation input
  const input = meta.input as Record<string, unknown>
  const width = typeof input.width === 'number' ? input.width : undefined
  const height = typeof input.height === 'number' ? input.height : undefined

  try {
    await db.insert(schema.runwareGenerations).values({
      id: generationId,
      model: meta.model,
      input: meta.input,
      artifactCount: successes.length,
      createdAt: new Date(meta.createdAt),
      completedAt: new Date(state.completedAt!),
    })

    for (const artifact of successes) {
      await db.insert(schema.runwareArtifacts).values({
        id: artifact.id,
        generationId,
        model: meta.model,
        r2Key: artifact.r2Key,
        contentType: artifact.contentType,
        width,
        height,
        seed: artifact.seed,
        cost: artifact.cost,
        metadata: artifact.metadata,
        createdAt: new Date(artifact.createdAt),
      })
    }

    // Persist tags for each artifact (if provided on the request)
    if (meta.tags && Object.keys(meta.tags).length > 0) {
      const tagRows = successes.flatMap((artifact) =>
        Object.entries(meta.tags!).map(([tag, value]) => ({
          tag,
          value,
          targetId: artifact.id,
        })),
      )
      // D1 limit: 100 params per query, 3 columns per row → max 33 rows
      for (let i = 0; i < tagRows.length; i += 33) {
        await db.insert(schema.tags).values(tagRows.slice(i, i + 33))
      }
    }
  } catch (err) {
    console.error('D1 projection failed', { generationId, error: err })
    const request = getRequest(ctx, generationId)
    await request.setError(projectionError(err))
  }
}
