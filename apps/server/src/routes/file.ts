import { db } from '@ig/db'
import { artifacts, tags } from '@ig/db/schema'
import { env } from '@ig/env/server'
import { and, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import type { Context } from 'hono'

export const fileRoutes = new Hono()

// Slug-based file serving: /a/{slug}[.ext]
// Resolves ig:slug tag → artifact, then serves the file
fileRoutes.get('/a/*', async (c) => {
  const path = c.req.path.slice('/a/'.length)
  const dot = path.indexOf('.')
  const slug = dot === -1 ? path : path.slice(0, dot)

  // Resolve slug → artifact ID via tag
  const [tagRow] = await db
    .select({ targetId: tags.targetId })
    .from(tags)
    .where(and(eq(tags.tag, 'ig:slug'), eq(tags.value, slug)))
    .limit(1)
  if (!tagRow) return c.json({ error: 'Not found' }, 404)

  // Fetch artifact for R2 key and content type
  const [artifact] = await db
    .select({ r2Key: artifacts.r2Key, contentType: artifacts.contentType })
    .from(artifacts)
    .where(eq(artifacts.id, tagRow.targetId))
    .limit(1)
  if (!artifact) return c.json({ error: 'Artifact not found' }, 404)

  return serveR2Object(c, artifact.r2Key, artifact.contentType)
})

// Artifact file serving: /artifacts/{id}/file[.ext]
// Optional query params for image transforms: ?w=512&h=512&f=webp&q=80&fit=cover
fileRoutes.get('/artifacts/:id/file*', async (c) => {
  const id = c.req.param('id')
  const result = await db.select().from(artifacts).where(eq(artifacts.id, id)).limit(1)
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
  }

  // Auto-negotiate based on Accept header
  if (formatParam === 'auto') {
    if (acceptHeader?.includes('image/avif')) return 'image/avif'
    if (acceptHeader?.includes('image/webp')) return 'image/webp'
    if (TRANSFORMABLE_TYPES.includes(originalType as OutputFormat)) {
      return originalType as OutputFormat
    }
    return 'image/jpeg'
  }

  // No format param — preserve original type if supported
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
  const object = await env.ARTIFACTS_BUCKET.get(r2Key)
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
