import { db } from "@ig/db";
import { artifacts } from "@ig/db/schema";
import { env } from "@ig/env/server";
import { eq } from "drizzle-orm";
import { Hono } from "hono";

type FalImage = {
  url: string;
  width?: number;
  height?: number;
  content_type?: string;
};

type FalWebhookPayload =
  | {
      status: "OK";
      request_id: string;
      payload: {
        images?: FalImage[];
        image?: FalImage;
        timings?: Record<string, number>;
        seed?: number;
        [key: string]: unknown;
      };
    }
  | {
      status: "ERROR";
      request_id: string;
      error: string;
      payload?: unknown;
    };

export const falWebhook = new Hono();

falWebhook.post("/", async (c) => {
  const artifactId = c.req.query("artifact_id");

  if (!artifactId) {
    console.error("Webhook received without artifact_id");
    return c.json({ error: "Missing artifact_id" }, 400);
  }

  const body = (await c.req.json()) as FalWebhookPayload;
  console.table({ event: "fal_webhook_received", artifactId, status: body.status, requestId: body.request_id });

  // Find the artifact
  const existing = await db.select().from(artifacts).where(eq(artifacts.id, artifactId)).limit(1);

  if (existing.length === 0) {
    console.error("Artifact not found", { artifactId });
    return c.json({ error: "Artifact not found" }, 404);
  }

  if (body.status === "ERROR") {
    // Handle error case
    await db
      .update(artifacts)
      .set({
        status: "failed",
        errorCode: "FAL_ERROR",
        errorMessage: body.error,
        completedAt: new Date(),
      })
      .where(eq(artifacts.id, artifactId));

    console.table({ event: "artifact_failed", artifactId, error: body.error });
    return c.json({ ok: true });
  }

  // Handle success case
  const payload = body.payload;

  // Get the first image from the response (different endpoints use different keys)
  const image = payload.image ?? payload.images?.[0];

  if (!image?.url) {
    await db
      .update(artifacts)
      .set({
        status: "failed",
        errorCode: "NO_IMAGE",
        errorMessage: "No image in response payload",
        completedAt: new Date(),
        falMetrics: payload.timings ? { timings: payload.timings, seed: payload.seed } : undefined,
      })
      .where(eq(artifacts.id, artifactId));

    console.error("No image in response", { artifactId, payload });
    return c.json({ ok: true });
  }

  // Fetch the image from fal CDN
  const imageResponse = await fetch(image.url);

  if (!imageResponse.ok) {
    await db
      .update(artifacts)
      .set({
        status: "failed",
        errorCode: "FETCH_FAILED",
        errorMessage: `Failed to fetch image: ${imageResponse.status}`,
        completedAt: new Date(),
      })
      .where(eq(artifacts.id, artifactId));

    console.error("Failed to fetch image from fal CDN", { artifactId, url: image.url, status: imageResponse.status });
    return c.json({ ok: true });
  }

  const imageBuffer = await imageResponse.arrayBuffer();
  const contentType = image.content_type ?? imageResponse.headers.get("content-type") ?? "image/png";

  // Upload to R2
  const r2Key = `artifacts/${artifactId}`;
  await env.ARTIFACTS_BUCKET.put(r2Key, imageBuffer, {
    httpMetadata: { contentType },
  });

  // Generate the public URL (assuming public R2 bucket or custom domain)
  // For now, we'll store the R2 key and the outputUrl can be configured later
  const outputUrl = `r2://${r2Key}`;

  // Update artifact to ready
  await db
    .update(artifacts)
    .set({
      status: "ready",
      outputUrl,
      contentType,
      completedAt: new Date(),
      falMetrics: { timings: payload.timings, seed: payload.seed, width: image.width, height: image.height },
    })
    .where(eq(artifacts.id, artifactId));

  console.table({ event: "artifact_ready", artifactId, contentType, r2Key });
  return c.json({ ok: true });
});
