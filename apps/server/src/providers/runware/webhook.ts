import { Hono } from 'hono'

import type { GenerationDO } from '../../do/generation'

type WebhookBindings = {
  GENERATION_DO: DurableObjectNamespace<GenerationDO>
}

export const webhook = new Hono<{ Bindings: WebhookBindings }>()

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

  const stub = c.env.GENERATION_DO.get(c.env.GENERATION_DO.idFromName(generationId))
  await stub.handleWebhook(payload)

  return c.body(null, 200)
})
