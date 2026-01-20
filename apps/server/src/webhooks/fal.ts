import type { WebHookResponse } from "@fal-ai/client";
import { db } from "@ig/db";
import { generations } from "@ig/db/schema";
import { env } from "@ig/env/server";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { v7 as uuidv7 } from "uuid";

import { verifyFalWebhook } from "./verify";

// Output resolution: either we have data to store, or we failed
type ResolvedOutput =
  | { ok: true; data: ArrayBuffer | Uint8Array; contentType: string }
  | { ok: false; errorCode: string; errorMessage: string };

/**
 * Resolves ALL outputs from a fal.ai webhook payload.
 * Returns an array of outputs - one for single output, multiple for batch outputs.
 */
async function resolveOutputs(payload: Record<string, unknown>): Promise<ResolvedOutput[]> {
  const outputs: ResolvedOutput[] = [];

  // Try to find file URLs - check common field names
  const fileFields = ["images", "image", "video", "audio", "audio_url"];

  for (const field of fileFields) {
    const value = payload[field];

    // Handle arrays of files
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item && typeof item === "object" && "url" in item) {
          const { url, content_type } = item as { url: string; content_type?: string };

          const response = await fetch(url);
          if (!response.ok) {
            outputs.push({
              ok: false,
              errorCode: "FETCH_FAILED",
              errorMessage: `Failed to fetch file: ${response.status}`,
            });
            continue;
          }

          outputs.push({
            ok: true,
            data: await response.arrayBuffer(),
            contentType: content_type ?? "application/octet-stream",
          });
        }
      }
      if (outputs.length > 0) return outputs;
    }

    // Handle single file object
    if (value && typeof value === "object" && "url" in value) {
      const { url, content_type } = value as { url: string; content_type?: string };

      const response = await fetch(url);
      if (!response.ok) {
        return [
          {
            ok: false,
            errorCode: "FETCH_FAILED",
            errorMessage: `Failed to fetch file: ${response.status}`,
          },
        ];
      }

      return [
        {
          ok: true,
          data: await response.arrayBuffer(),
          contentType: content_type ?? "application/octet-stream",
        },
      ];
    }
  }

  // Try to find text output
  const textFields = ["output", "text"];

  for (const field of textFields) {
    const value = payload[field];
    if (typeof value === "string") {
      return [
        {
          ok: true,
          data: new TextEncoder().encode(value),
          contentType: "text/plain; charset=utf-8",
        },
      ];
    }
  }

  return [
    {
      ok: false,
      errorCode: "UNKNOWN_OUTPUT",
      errorMessage: `Could not find output in payload. Fields: ${Object.keys(payload).join(", ")}`,
    },
  ];
}

export const falWebhook = new Hono();

falWebhook.post("/", async (c) => {
  // Verify webhook signature
  const rawBody = await c.req.arrayBuffer();
  const verification = await verifyFalWebhook(c.req.raw.headers, rawBody);
  if (!verification.valid) {
    console.error("webhook_verification_failed", { error: verification.error });
    return c.json({ error: "Invalid webhook signature" }, 401);
  }

  const generationId = c.req.query("generation_id");
  if (!generationId) {
    console.error("webhook_missing_generation_id");
    return c.json({ error: "Missing generation_id" }, 400);
  }

  const body = JSON.parse(new TextDecoder().decode(rawBody)) as WebHookResponse;
  const payload = (body.payload ?? {}) as Record<string, unknown>;

  console.log("fal_webhook_received", {
    generationId,
    status: body.status,
    requestId: body.request_id,
  });

  // Verify generation exists
  const existing = await db
    .select()
    .from(generations)
    .where(eq(generations.id, generationId))
    .limit(1);
  if (existing.length === 0) {
    console.error("webhook_generation_not_found", { generationId });
    return c.json({ error: "Generation not found" }, 404);
  }

  // Handle fal errors
  if (body.status === "ERROR") {
    await db
      .update(generations)
      .set({
        status: "failed",
        errorCode: "FAL_ERROR",
        errorMessage: body.error ?? "Unknown error",
        completedAt: new Date(),
        providerMetadata: payload,
      })
      .where(eq(generations.id, generationId));

    console.log("generation_failed", { generationId, errorCode: "FAL_ERROR" });
    return c.json({ ok: true });
  }

  // Resolve outputs
  const outputs = await resolveOutputs(payload);

  // Handle multi-output: create additional generation records
  if (outputs.length > 1) {
    const batchTag = `batch:${generationId}`;
    const originalGen = existing[0];

    if (!originalGen) {
      console.error("webhook_generation_not_found_after_check", { generationId });
      return c.json({ error: "Generation not found" }, 404);
    }

    for (let i = 0; i < outputs.length; i++) {
      const output = outputs[i];
      if (!output) continue;

      const isFirst = i === 0;
      const genId = isFirst ? generationId : uuidv7();

      // Create new generation record for non-first outputs
      if (!isFirst) {
        await db.insert(generations).values({
          id: genId,
          status: output.ok ? "ready" : "failed",
          endpoint: originalGen.endpoint,
          input: originalGen.input,
          tags: [...originalGen.tags, batchTag],
          contentType: output.ok ? output.contentType : null,
          errorCode: output.ok ? null : output.errorCode,
          errorMessage: output.ok ? null : output.errorMessage,
          providerRequestId: body.request_id,
          providerMetadata: payload,
          createdAt: originalGen.createdAt,
          completedAt: new Date(),
        });
      }

      // Store to R2 and update DB
      if (output.ok) {
        const r2Key = `generations/${genId}`;
        await env.GENERATIONS_BUCKET.put(r2Key, output.data, {
          httpMetadata: { contentType: output.contentType },
        });

        await db
          .update(generations)
          .set({
            status: "ready",
            contentType: output.contentType,
            completedAt: new Date(),
            providerMetadata: payload,
            ...(isFirst ? {} : { tags: [...originalGen.tags, batchTag] }),
          })
          .where(eq(generations.id, genId));

        console.log("generation_ready", {
          generationId: genId,
          contentType: output.contentType,
          batch: !isFirst,
        });
      } else if (isFirst) {
        // Only update first generation if it's an error
        await db
          .update(generations)
          .set({
            status: "failed",
            errorCode: output.errorCode,
            errorMessage: output.errorMessage,
            completedAt: new Date(),
            providerMetadata: payload,
          })
          .where(eq(generations.id, genId));

        console.log("generation_failed", { generationId: genId, errorCode: output.errorCode });
      }
    }

    return c.json({ ok: true, count: outputs.length });
  }

  // Single output path
  const output = outputs[0];
  if (!output) {
    console.error("no_output_resolved", { generationId });
    return c.json({ error: "No output resolved" }, 500);
  }
  const r2Key = `generations/${generationId}`;

  if (output.ok) {
    await env.GENERATIONS_BUCKET.put(r2Key, output.data, {
      httpMetadata: { contentType: output.contentType },
    });
  }

  await db
    .update(generations)
    .set({
      status: output.ok ? "ready" : "failed",
      contentType: output.ok ? output.contentType : null,
      errorCode: output.ok ? null : output.errorCode,
      errorMessage: output.ok ? null : output.errorMessage,
      completedAt: new Date(),
      providerMetadata: payload,
    })
    .where(eq(generations.id, generationId));

  if (output.ok) {
    console.log("generation_ready", { generationId, contentType: output.contentType });
  } else {
    console.log("generation_failed", { generationId, errorCode: output.errorCode });
  }

  return c.json({ ok: true });
});
