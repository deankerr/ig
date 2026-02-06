/**
 * fal.ai webhook handler
 *
 * Receives inference results from fal.ai and updates the generation record.
 */

import { Hono } from "hono"

import type { Services } from "../../services"
import { resolveFalWebhook } from "./resolve"

type Variables = { services: Services }

export const webhook = new Hono<{ Bindings: Env; Variables: Variables }>()

webhook.post("/", async (c) => {
  const generationId = c.req.query("generation_id")
  if (!generationId) {
    console.error("fal_webhook_missing_generation_id")
    return c.body(null, 400)
  }

  const { generations } = c.var.services

  const gen = await generations.get({ id: generationId })
  if (!gen) {
    console.error("fal_webhook_generation_not_found", { generationId })
    return c.body(null, 404)
  }

  // Idempotency: already processed
  if (gen.status === "ready" || gen.status === "failed") {
    return c.body(null, 200)
  }

  const rawBody = await c.req.arrayBuffer()
  const result = await resolveFalWebhook(rawBody, c.req.raw.headers)

  console.log("fal_webhook", {
    generationId,
    ok: result.ok,
    outputCount: result.ok ? result.value.outputs.length : 0,
  })

  await generations.complete({ id: generationId, provider: "fal", result })

  return c.body(null, 200)
})
