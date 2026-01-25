import { db } from "@ig/db"
import { generations } from "@ig/db/schema"
import { env } from "@ig/env/server"
import { eq } from "drizzle-orm"
import { Hono } from "hono"
import type { Context } from "hono"
import type { Generation } from "@ig/db/schema"

export const fileRoutes = new Hono()

// * routes

// Short URL for slugs: /art/{slug}.{ext}
fileRoutes.get("/art/*", async (c) => {
  const path = c.req.path.slice("/art/".length)
  const dotIndex = path.indexOf(".")
  const slug = dotIndex === -1 ? path : path.slice(0, dotIndex)

  const result = await db.select().from(generations).where(eq(generations.slug, slug)).limit(1)
  const generation = result[0]

  if (!generation) return c.json({ error: "Generation not found" }, 404)
  if (generation.status !== "ready") {
    return c.json({ error: "Generation not ready", status: generation.status }, 400)
  }

  const r2Key = `generations/${generation.id}`
  const object = await env.GENERATIONS_BUCKET.get(r2Key)
  if (!object) return c.json({ error: "File not found in storage" }, 404)

  const contentType = generation.contentType ?? "application/octet-stream"

  return new Response(object.body, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  })
})

// Full URL with ID or slug: /generations/{id}/file*
fileRoutes.get("/generations/:id/file*", async (c) => {
  const id = c.req.param("id")
  const result = await db.select().from(generations).where(eq(generations.id, id)).limit(1)
  return serveGeneration(c, result[0])
})

// * handler
async function serveGeneration(c: Context, generation: Generation | undefined) {
  if (!generation) return c.json({ error: "Generation not found" }, 404)
  if (generation.status !== "ready") {
    return c.json({ error: "Generation not ready", status: generation.status }, 400)
  }

  // Fetch from R2 using the canonical ID
  const r2Key = `generations/${generation.id}`
  const object = await env.GENERATIONS_BUCKET.get(r2Key)
  if (!object) return c.json({ error: "File not found" }, 404)

  const contentType = generation.contentType ?? "application/octet-stream"

  return new Response(object.body, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  })
}
