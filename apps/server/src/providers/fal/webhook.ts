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
    return c.json({ error: "Missing generation_id" }, 400)
  }

  const { generations } = c.var.services

  // Verify generation exists
  const gen = await generations.get({ id: generationId })
  if (!gen) {
    console.error("fal_webhook_generation_not_found", { generationId })
    return c.json({ error: "Generation not found" }, 404)
  }

  // Idempotency: if already processed, return success without reprocessing
  if (gen.status === "ready" || gen.status === "failed") {
    console.log("fal_webhook_already_processed", { generationId, status: gen.status })
    return c.json({ ok: true, alreadyProcessed: true })
  }

  // Resolve the webhook payload (verify, parse, fetch)
  const rawBody = await c.req.arrayBuffer()
  const result = await resolveFalWebhook(rawBody, c.req.raw.headers)

  console.log("fal_webhook_received", {
    generationId,
    ok: result.ok,
    requestId: result.ok ? result.requestId : undefined,
    outputCount: result.ok ? result.outputs.length : 0,
  })

  // Complete the generation with the resolved result
  await generations.complete({
    id: generationId,
    provider: "fal",
    result,
  })

  if (result.ok) {
    return c.json({ ok: true, count: result.outputs.length })
  }
  return c.json({ ok: true })
})
