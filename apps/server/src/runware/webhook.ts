/**
 * Runware webhook handler
 *
 * Receives inference results from Runware and updates the generation record.
 * Runware webhook payloads are simpler and more standardized than fal.ai.
 */

import { db } from "@ig/db"
import { generations } from "@ig/db/schema"
import { env } from "@ig/env/server"
import { eq } from "drizzle-orm"
import { Hono } from "hono"
import { v7 as uuidv7 } from "uuid"

import { resolveRunwareOutputs } from "./output"

export const runwareWebhook = new Hono()

/**
 * Runware webhook payload structure
 */
type RunwareWebhookPayload = {
  taskType: string
  taskUUID: string
  imageUUID?: string
  videoUUID?: string
  imageURL?: string
  videoURL?: string
  imageDataURI?: string
  imageBase64Data?: string
  cost?: number
  seed?: number
  NSFWContent?: boolean
  error?: string
  errorMessage?: string
  [key: string]: unknown
}

runwareWebhook.post("/", async (c) => {
  const generationId = c.req.query("generation_id")
  if (!generationId) {
    console.error("runware_webhook_missing_generation_id")
    return c.json({ error: "Missing generation_id" }, 400)
  }

  let payload: RunwareWebhookPayload
  try {
    payload = await c.req.json()
  } catch {
    console.error("runware_webhook_invalid_json")
    return c.json({ error: "Invalid JSON" }, 400)
  }

  console.log("runware_webhook_received", {
    generationId,
    taskType: payload.taskType,
    taskUUID: payload.taskUUID,
    hasError: !!payload.error,
  })

  // Verify generation exists
  const existing = await db
    .select()
    .from(generations)
    .where(eq(generations.id, generationId))
    .limit(1)

  if (existing.length === 0) {
    console.error("runware_webhook_generation_not_found", { generationId })
    return c.json({ error: "Generation not found" }, 404)
  }

  const originalGen = existing[0]
  if (!originalGen) {
    console.error("runware_webhook_generation_not_found_after_check", { generationId })
    return c.json({ error: "Generation not found" }, 404)
  }

  // Idempotency: if already processed, return success
  if (originalGen.status === "ready" || originalGen.status === "failed") {
    console.log("runware_webhook_already_processed", { generationId, status: originalGen.status })
    return c.json({ ok: true, alreadyProcessed: true })
  }

  // Handle errors
  if (payload.error || payload.errorMessage) {
    await db
      .update(generations)
      .set({
        status: "failed",
        errorCode: "RUNWARE_ERROR",
        errorMessage: payload.errorMessage ?? payload.error ?? "Unknown error",
        completedAt: new Date(),
        providerMetadata: payload,
      })
      .where(eq(generations.id, generationId))

    console.log("runware_generation_failed", { generationId, errorCode: "RUNWARE_ERROR" })
    return c.json({ ok: true })
  }

  // Resolve outputs
  const outputs = await resolveRunwareOutputs(payload)

  // Handle multi-output (if Runware returns multiple results)
  if (outputs.length > 1) {
    const batchTag = `batch:${generationId}`

    for (let i = 0; i < outputs.length; i++) {
      const output = outputs[i]
      if (!output) continue

      const isFirst = i === 0
      const genId = isFirst ? generationId : uuidv7()

      // Create new generation record for non-first outputs
      if (!isFirst) {
        await db.insert(generations).values({
          id: genId,
          status: output.ok ? "ready" : "failed",
          provider: "runware",
          endpoint: originalGen.endpoint,
          input: originalGen.input,
          tags: [...originalGen.tags, batchTag],
          contentType: output.ok ? output.contentType : null,
          errorCode: output.ok ? null : output.errorCode,
          errorMessage: output.ok ? null : output.errorMessage,
          providerRequestId: payload.taskUUID,
          providerMetadata: {
            ...payload,
            cost: output.ok ? output.cost : undefined,
          },
          createdAt: originalGen.createdAt,
          completedAt: new Date(),
        })
      }

      // Store to R2 and update DB
      if (output.ok) {
        const r2Key = `generations/${genId}`
        await env.GENERATIONS_BUCKET.put(r2Key, output.data, {
          httpMetadata: { contentType: output.contentType },
        })

        await db
          .update(generations)
          .set({
            status: "ready",
            contentType: output.contentType,
            completedAt: new Date(),
            providerMetadata: {
              ...payload,
              cost: output.cost,
            },
            ...(isFirst ? {} : { tags: [...originalGen.tags, batchTag] }),
          })
          .where(eq(generations.id, genId))

        console.log("runware_generation_ready", {
          generationId: genId,
          contentType: output.contentType,
          cost: output.cost,
          batch: !isFirst,
        })
      } else if (isFirst) {
        await db
          .update(generations)
          .set({
            status: "failed",
            errorCode: output.errorCode,
            errorMessage: output.errorMessage,
            completedAt: new Date(),
            providerMetadata: payload,
          })
          .where(eq(generations.id, genId))

        console.log("runware_generation_failed", {
          generationId: genId,
          errorCode: output.errorCode,
        })
      }
    }

    return c.json({ ok: true, count: outputs.length })
  }

  // Single output path
  const output = outputs[0]
  if (!output) {
    console.error("runware_no_output_resolved", { generationId })
    return c.json({ error: "No output resolved" }, 500)
  }

  const r2Key = `generations/${generationId}`

  if (output.ok) {
    await env.GENERATIONS_BUCKET.put(r2Key, output.data, {
      httpMetadata: { contentType: output.contentType },
    })
  }

  await db
    .update(generations)
    .set({
      status: output.ok ? "ready" : "failed",
      contentType: output.ok ? output.contentType : null,
      errorCode: output.ok ? null : output.errorCode,
      errorMessage: output.ok ? null : output.errorMessage,
      completedAt: new Date(),
      providerMetadata: {
        ...payload,
        cost: output.ok ? output.cost : undefined,
      },
    })
    .where(eq(generations.id, generationId))

  if (output.ok) {
    console.log("runware_generation_ready", {
      generationId,
      contentType: output.contentType,
      cost: output.cost,
    })
  } else {
    console.log("runware_generation_failed", { generationId, errorCode: output.errorCode })
  }

  return c.json({ ok: true })
})
