import type { WebHookResponse } from "@fal-ai/client";
import { db } from "@ig/db";
import { artifacts } from "@ig/db/schema";
import { env } from "@ig/env/server";
import { eq } from "drizzle-orm";
import { Hono } from "hono";

import { verifyFalWebhook } from "./verify";

// Output resolution: either we have data to store, or we failed
type ResolvedOutput =
  | { ok: true; data: ArrayBuffer | Uint8Array; contentType: string }
  | { ok: false; errorCode: string; errorMessage: string };

/**
 * Resolves the output from a fal.ai webhook payload.
 * Looks for file URLs first, then text content.
 */
async function resolveOutput(payload: Record<string, unknown>): Promise<ResolvedOutput> {
  // Try to find a file URL - check common field names
  const fileFields = ["images", "image", "video", "audio", "audio_url"];

  for (const field of fileFields) {
    const value = payload[field];

    // Could be array (take first) or single object
    const file = Array.isArray(value) ? value[0] : value;

    if (file && typeof file === "object" && "url" in file) {
      const { url, content_type } = file as { url: string; content_type?: string };

      const response = await fetch(url);
      if (!response.ok) {
        return {
          ok: false,
          errorCode: "FETCH_FAILED",
          errorMessage: `Failed to fetch file: ${response.status}`,
        };
      }

      return {
        ok: true,
        data: await response.arrayBuffer(),
        contentType: content_type ?? "application/octet-stream",
      };
    }
  }

  // Try to find text output
  const textFields = ["output", "text"];

  for (const field of textFields) {
    const value = payload[field];
    if (typeof value === "string") {
      return {
        ok: true,
        data: new TextEncoder().encode(value),
        contentType: "text/plain; charset=utf-8",
      };
    }
  }

  return {
    ok: false,
    errorCode: "UNKNOWN_OUTPUT",
    errorMessage: `Could not find output in payload. Fields: ${Object.keys(payload).join(", ")}`,
  };
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

  const artifactId = c.req.query("artifact_id");
  if (!artifactId) {
    console.error("webhook_missing_artifact_id");
    return c.json({ error: "Missing artifact_id" }, 400);
  }

  const body = JSON.parse(new TextDecoder().decode(rawBody)) as WebHookResponse;
  const payload = (body.payload ?? {}) as Record<string, unknown>;

  console.log("fal_webhook_received", {
    artifactId,
    status: body.status,
    requestId: body.request_id,
  });

  // Verify artifact exists
  const existing = await db.select().from(artifacts).where(eq(artifacts.id, artifactId)).limit(1);
  if (existing.length === 0) {
    console.error("webhook_artifact_not_found", { artifactId });
    return c.json({ error: "Artifact not found" }, 404);
  }

  // Resolve what we're storing
  const output: ResolvedOutput =
    body.status === "ERROR"
      ? { ok: false, errorCode: "FAL_ERROR", errorMessage: body.error ?? "Unknown error" }
      : await resolveOutput(payload);

  // Store to R2 if successful
  const r2Key = `artifacts/${artifactId}`;
  if (output.ok) {
    await env.ARTIFACTS_BUCKET.put(r2Key, output.data, {
      httpMetadata: { contentType: output.contentType },
    });
  }

  // Single DB update
  await db
    .update(artifacts)
    .set({
      status: output.ok ? "ready" : "failed",
      outputUrl: output.ok ? `r2://${r2Key}` : null,
      contentType: output.ok ? output.contentType : null,
      errorCode: output.ok ? null : output.errorCode,
      errorMessage: output.ok ? null : output.errorMessage,
      completedAt: new Date(),
      falOutput: payload,
    })
    .where(eq(artifacts.id, artifactId));

  if (output.ok) {
    console.log("artifact_ready", { artifactId, contentType: output.contentType });
  } else {
    console.log("artifact_failed", { artifactId, errorCode: output.errorCode });
  }

  return c.json({ ok: true });
});
