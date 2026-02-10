import { Hono } from 'hono'

import { processWebhookResults } from './process'

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

  // biome-ignore lint: env type cast needed to break circular depth
  const ns = (c.env as any).GENERATION_DO
  const stub = ns.get(ns.idFromName(generationId))
  const result = await stub.recordWebhook(payload)

  // Process results in background — don't block Runware's webhook
  if (result.items.length > 0) {
    c.executionCtx.waitUntil(
      processWebhookResults(c.env, {
        generationId,
        meta: result.meta,
        items: result.items,
      }),
    )
  }

  return c.body(null, 200)
})
