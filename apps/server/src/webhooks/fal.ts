import type { WebHookResponse } from "@fal-ai/client";
import { db } from "@ig/db";
import { artifacts } from "@ig/db/schema";
import { env } from "@ig/env/server";
import { eq } from "drizzle-orm";
import { Hono } from "hono";

type FalFile = {
  url: string;
  content_type?: string;
};

function findFileInPayload(payload: Record<string, unknown>): FalFile | null {
  // Common field names for file outputs
  const fileFields = ["images", "image", "video", "audio", "audio_url"];

  for (const field of fileFields) {
    const value = payload[field];

    // Array of files - take first
    if (Array.isArray(value) && value[0]?.url) {
      return value[0] as FalFile;
    }

    // Single file object
    if (value && typeof value === "object" && "url" in value) {
      return value as FalFile;
    }
  }

  return null;
}

function findTextInPayload(payload: Record<string, unknown>): string | null {
  // Common field names for text outputs
  const textFields = ["output", "text"];

  for (const field of textFields) {
    const value = payload[field];
    if (typeof value === "string") {
      return value;
    }
  }

  return null;
}

export const falWebhook = new Hono();

falWebhook.post("/", async (c) => {
  const artifactId = c.req.query("artifact_id");

  if (!artifactId) {
    console.error("Webhook received without artifact_id");
    return c.json({ error: "Missing artifact_id" }, 400);
  }

  const body = (await c.req.json()) as WebHookResponse;
  console.log("fal_webhook_received", {
    artifactId,
    status: body.status,
    requestId: body.request_id,
  });

  // Find the artifact
  const existing = await db.select().from(artifacts).where(eq(artifacts.id, artifactId)).limit(1);

  if (existing.length === 0) {
    console.error("Artifact not found", { artifactId });
    return c.json({ error: "Artifact not found" }, 404);
  }

  if (body.status === "ERROR") {
    await db
      .update(artifacts)
      .set({
        status: "failed",
        errorCode: "FAL_ERROR",
        errorMessage: body.error,
        completedAt: new Date(),
        falOutput: body.payload as Record<string, unknown>,
      })
      .where(eq(artifacts.id, artifactId));

    console.log("artifact_failed", { artifactId, error: body.error });
    return c.json({ ok: true });
  }

  const payload = body.payload as Record<string, unknown>;

  // Try to find a file URL in the payload
  const file = findFileInPayload(payload);

  if (file) {
    const fileResponse = await fetch(file.url);

    if (!fileResponse.ok) {
      await db
        .update(artifacts)
        .set({
          status: "failed",
          errorCode: "FETCH_FAILED",
          errorMessage: `Failed to fetch file: ${fileResponse.status}`,
          completedAt: new Date(),
          falOutput: payload,
        })
        .where(eq(artifacts.id, artifactId));

      console.error("Failed to fetch file from fal CDN", {
        artifactId,
        url: file.url,
        status: fileResponse.status,
      });
      return c.json({ ok: true });
    }

    const fileBuffer = await fileResponse.arrayBuffer();
    const contentType = file.content_type ?? "application/octet-stream";

    const r2Key = `artifacts/${artifactId}`;
    await env.ARTIFACTS_BUCKET.put(r2Key, fileBuffer, {
      httpMetadata: { contentType },
    });

    await db
      .update(artifacts)
      .set({
        status: "ready",
        outputUrl: `r2://${r2Key}`,
        contentType,
        completedAt: new Date(),
        falOutput: payload,
      })
      .where(eq(artifacts.id, artifactId));

    console.log("artifact_ready", { artifactId, contentType, r2Key });
    return c.json({ ok: true });
  }

  // Try to find text output
  const text = findTextInPayload(payload);

  if (text) {
    const r2Key = `artifacts/${artifactId}`;
    const textBuffer = new TextEncoder().encode(text);
    await env.ARTIFACTS_BUCKET.put(r2Key, textBuffer, {
      httpMetadata: { contentType: "text/plain; charset=utf-8" },
    });

    await db
      .update(artifacts)
      .set({
        status: "ready",
        outputUrl: `r2://${r2Key}`,
        contentType: "text/plain; charset=utf-8",
        completedAt: new Date(),
        falOutput: payload,
      })
      .where(eq(artifacts.id, artifactId));

    console.log("artifact_ready", { artifactId, contentType: "text/plain", r2Key });
    return c.json({ ok: true });
  }

  // Unknown output format - store payload for debugging
  await db
    .update(artifacts)
    .set({
      status: "failed",
      errorCode: "UNKNOWN_OUTPUT",
      errorMessage: "Could not find file or text output in payload",
      completedAt: new Date(),
      falOutput: payload,
    })
    .where(eq(artifacts.id, artifactId));

  console.error("Unknown output format", { artifactId, payloadKeys: Object.keys(payload) });
  return c.json({ ok: true });
});
