/**
 * Runware webhook handler
 *
 * Receives inference results from Runware and updates the generation record.
 */

import { Hono } from "hono"

import type { Services } from "../../services"
import { resolveRunwareWebhook } from "./resolve"

type Variables = { services: Services }

export const webhook = new Hono<{ Bindings: Env; Variables: Variables }>()

webhook.post("/", async (c) => {
  const generationId = c.req.query("generation_id")
  if (!generationId) {
    console.error("runware_webhook_missing_generation_id")
    return c.body(null, 400)
  }

  const { generations } = c.var.services

  const gen = await generations.get({ id: generationId })
  if (!gen) {
    console.error("runware_webhook_generation_not_found", { generationId })
    return c.body(null, 404)
  }

  // Idempotency: already processed
  if (gen.status === "ready" || gen.status === "failed") {
    return c.body(null, 200)
  }

  let rawPayload: unknown
  try {
    rawPayload = await c.req.json()
  } catch {
    console.error("runware_webhook_invalid_json")
    return c.body(null, 400)
  }

  const result = await resolveRunwareWebhook(rawPayload)

  console.log("runware_webhook", {
    generationId,
    ok: result.ok,
    outputCount: result.ok ? result.value.outputs.length : 0,
  })

  await generations.complete({ id: generationId, provider: "runware", result })

  return c.body(null, 200)
})
