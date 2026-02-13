// Runware webhook handler — receives webhook, delegates to DO, processes artifacts in background.

import { Hono } from 'hono'

import type { Context } from '../context'
import * as persist from './persist'
import { getRequest, type WebhookItem, type RequestMeta } from './request'
import type { Output } from './result'
import { getContentType } from './schema'
import { storeArtifact } from './store'

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

  const ctx: Context = {
    env: c.env,
    headers: c.req.raw.headers,
    waitUntil: c.executionCtx.waitUntil.bind(c.executionCtx),
  }
  const request = getRequest(ctx, generationId)
  const result = await request.recordWebhook(payload)

  if (result.items.length > 0) {
    ctx.waitUntil(
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
  items: WebhookItem[]
}

async function processWebhookResults(ctx: Context, args: ProcessArgs) {
  const { generationId, meta, items } = args
  const contentType = getContentType(meta.outputFormat)
  const now = new Date()

  // Store each artifact to R2 and insert to D1 progressively
  const results: Output[] = []
  for (const item of items) {
    const result = await storeArtifact(ctx, { item, contentType, now })
    results.push(result)

    // Progressive D1 projection — artifact row appears as it's stored
    if (result.type === 'success') {
      await persist.insertArtifact(ctx.env.DB, {
        artifact: result,
        generationId,
        model: meta.model,
        input: meta.input,
        tags: meta.tags,
      })
    }
  }

  // Confirm outputs with DO
  const request = getRequest(ctx, generationId)
  const { complete } = await request.confirmOutputs(results)

  // On completion, update D1 generation with completedAt
  if (complete) {
    const state = await request.getState()
    if (state?.completedAt) {
      await persist.completeGeneration(ctx.env.DB, {
        id: generationId,
        completedAt: state.completedAt,
      })
    }
  }
}
