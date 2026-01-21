import { db } from "@ig/db"
import { generations } from "@ig/db/schema"
import { env } from "@ig/env/server"
import { eq } from "drizzle-orm"
import { Hono } from "hono"

const IMAGE_INPUT_FORMATS = ["image/png", "image/jpeg", "image/gif", "image/webp"]

const IMAGE_OUTPUT_FORMATS = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/avif",
] as const
type ImageOutputFormat = (typeof IMAGE_OUTPUT_FORMATS)[number]

export const fileRoutes = new Hono()

fileRoutes.get("/generations/:id/file*", async (c) => {
  const id = c.req.param("id")

  // Validate generation exists and is ready
  const result = await db.select().from(generations).where(eq(generations.id, id)).limit(1)
  const generation = result[0]

  if (!generation) return c.json({ error: "Generation not found" }, 404)
  if (generation.status !== "ready") {
    return c.json({ error: "Generation not ready", status: generation.status }, 400)
  }

  // Fetch from R2
  const r2Key = `generations/${id}`
  const object = await env.GENERATIONS_BUCKET.get(r2Key)
  if (!object) return c.json({ error: "File not found in storage" }, 404)

  const contentType = generation.contentType ?? "application/octet-stream"

  // Parse transform params
  const url = new URL(c.req.url)
  const w = url.searchParams.get("w")
  const h = url.searchParams.get("h")
  const f = url.searchParams.get("f")
  const q = url.searchParams.get("q")

  // Check if transforms requested and content is transformable
  const hasTransformParams = w || h || f || q
  const isTransformable = IMAGE_INPUT_FORMATS.includes(contentType)

  // No transforms or non-image - serve original
  if (!hasTransformParams || !isTransformable) {
    return new Response(object.body, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    })
  }

  // Build transform pipeline
  let pipeline = env.IMAGES.input(object.body)

  // Apply size transforms
  const transformOpts: Record<string, number> = {}
  if (w) transformOpts.width = parseInt(w, 10)
  if (h) transformOpts.height = parseInt(h, 10)
  if (Object.keys(transformOpts).length) {
    pipeline = pipeline.transform(transformOpts)
  }

  // Negotiate output format via Accept header - fall back to original content type
  const acceptHeader = c.req.header("accept") ?? ""
  const outputFormat = negotiateFormat(f, acceptHeader) ?? (contentType as ImageOutputFormat)

  // Apply output options
  const outputOpts: { format: ImageOutputFormat; quality?: number } = { format: outputFormat }
  if (q) outputOpts.quality = parseInt(q, 10)

  const transformed = await pipeline.output(outputOpts)
  const response = transformed.response()

  return new Response(response.body, {
    headers: {
      "Content-Type": response.headers.get("Content-Type") ?? contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  })
})

const FORMAT_MAP: Record<string, ImageOutputFormat> = {
  png: "image/png",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
}

function negotiateFormat(requested: string | null, acceptHeader: string): ImageOutputFormat | null {
  if (!requested) return null

  // Map short name to mime type, invalid formats return null
  const format = FORMAT_MAP[requested]
  if (!format) return null

  // Not avif - use as-is (png, jpeg, gif, webp always supported)
  if (format !== "image/avif") return format

  // avif requested - check Accept header for client support
  if (acceptHeader.includes("image/avif")) return "image/avif"
  if (acceptHeader.includes("image/webp")) return "image/webp"

  // Client doesn't support modern formats - no format transform
  return null
}
