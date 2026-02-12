import { db } from '@ig/db'
import { generations, runwareArtifacts } from '@ig/db/schema'
import { env } from '@ig/env/server'
import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import type { Context } from 'hono'

export const fileRoutes = new Hono()

// * routes

// Short URL for slugs: /art/{slug}.{ext}
fileRoutes.get('/art/*', async (c) => {
  const path = c.req.path.slice('/art/'.length)
  const dotIndex = path.indexOf('.')
  const slug = dotIndex === -1 ? path : path.slice(0, dotIndex)

  const result = await db.select().from(generations).where(eq(generations.slug, slug)).limit(1)
  const gen = result[0]
  if (!gen) return c.json({ error: 'Generation not found' }, 404)
  if (gen.status !== 'ready') {
    return c.json({ error: 'Generation not ready', status: gen.status }, 400)
  }
  return serveR2Object(c, `generations/${gen.id}`, gen.contentType ?? 'application/octet-stream')
})

// Full URL with ID or slug: /generations/{id}/file*
fileRoutes.get('/generations/:id/file*', async (c) => {
  const id = c.req.param('id')
  const result = await db.select().from(generations).where(eq(generations.id, id)).limit(1)
  const gen = result[0]
  if (!gen) return c.json({ error: 'Generation not found' }, 404)
  if (gen.status !== 'ready') {
    return c.json({ error: 'Generation not ready', status: gen.status }, 400)
  }
  return serveR2Object(c, `generations/${gen.id}`, gen.contentType ?? 'application/octet-stream')
})

// Artifact file serving: /artifacts/{id}/file*
fileRoutes.get('/artifacts/:id/file*', async (c) => {
  const id = c.req.param('id')
  const result = await db
    .select()
    .from(runwareArtifacts)
    .where(eq(runwareArtifacts.id, id))
    .limit(1)
  const artifact = result[0]
  if (!artifact) return c.json({ error: 'Artifact not found' }, 404)
  return serveR2Object(c, artifact.r2Key, artifact.contentType)
})

// * image transforms

type OutputFormat = 'image/avif' | 'image/webp' | 'image/jpeg' | 'image/png' | 'image/gif'
type FitMode = 'scale-down' | 'contain' | 'cover' | 'crop' | 'pad' | 'squeeze'

// Formats the Images binding can process as input and output
const TRANSFORMABLE_TYPES: OutputFormat[] = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

const FORMAT_MAP: Record<string, OutputFormat> = {
  avif: 'image/avif',
  webp: 'image/webp',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
}

const FIT_MAP: Record<string, FitMode> = {
  'scale-down': 'scale-down',
  contain: 'contain',
  cover: 'cover',
  crop: 'crop',
  pad: 'pad',
  squeeze: 'squeeze',
}

/**
 * Resolve output format based on:
 * 1. Explicit format param (f=webp) → use it
 * 2. Auto-negotiate (f=auto) → check Accept header, fallback to original
 * 3. No format param → use original type
 */
function resolveOutputFormat(
  formatParam: string | undefined,
  acceptHeader: string | undefined,
  originalType: string,
): OutputFormat {
  // Explicit format (not "auto")
  if (formatParam && formatParam !== 'auto') {
    const explicit = FORMAT_MAP[formatParam]
    if (explicit) return explicit
    // Invalid format param, fall through to original
  }

  // Auto-negotiate based on Accept header
  if (formatParam === 'auto') {
    if (acceptHeader?.includes('image/avif')) return 'image/avif'
    if (acceptHeader?.includes('image/webp')) return 'image/webp'
    // Fallback to original if supported, else jpeg
    if (TRANSFORMABLE_TYPES.includes(originalType as OutputFormat)) {
      return originalType as OutputFormat
    }
    return 'image/jpeg'
  }

  // No format param - preserve original type if supported
  if (TRANSFORMABLE_TYPES.includes(originalType as OutputFormat)) {
    return originalType as OutputFormat
  }
  return 'image/jpeg'
}

function parseTransformParams(c: Context, originalType: string) {
  const width = c.req.query('w')
  const height = c.req.query('h')
  const format = c.req.query('f')
  const quality = c.req.query('q')
  const fit = c.req.query('fit')

  const hasTransform = width || height || format || quality || fit
  if (!hasTransform) return null

  const acceptHeader = c.req.header('Accept')

  return {
    width: width ? Number(width) : undefined,
    height: height ? Number(height) : undefined,
    format: resolveOutputFormat(format, acceptHeader, originalType),
    quality: quality ? Number(quality) : 80,
    fit: fit ? (FIT_MAP[fit] ?? 'scale-down') : 'scale-down',
  }
}

// * shared handler

async function serveR2Object(c: Context, r2Key: string, contentType: string) {
  const object = await env.GENERATIONS_BUCKET.get(r2Key)
  if (!object) return c.json({ error: 'File not found' }, 404)

  const canTransform = TRANSFORMABLE_TYPES.includes(contentType as OutputFormat)
  const transform = parseTransformParams(c, contentType)

  // Apply image transforms if requested and content is transformable
  if (canTransform && transform) {
    const result = await env.IMAGES.input(object.body)
      .transform({
        width: transform.width,
        height: transform.height,
        fit: transform.fit,
      })
      .output({ format: transform.format, quality: transform.quality })

    const response = result.response()
    response.headers.set('Cache-Control', 'public, max-age=31536000, immutable')
    return response
  }

  // Return raw file
  return new Response(object.body, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
}
