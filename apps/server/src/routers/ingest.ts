// Ingest router — create artifacts via file upload or URL fetch.

import { db } from '@ig/db'
import * as schema from '@ig/db/schema'
import { ORPCError } from '@orpc/server'
import { v7 as uuidv7 } from 'uuid'
import { z } from 'zod'

import { procedure } from '../orpc'
import { detectFile } from '../services/file-detection'
import { TAG_KEYS, tagsService, zTagsRecord } from '../services/tags'

// 100 MB — abort ingestion beyond this
const MAX_INGEST_BYTES = 100 * 1024 * 1024

// 30 seconds — abort slow fetches
const FETCH_TIMEOUT_MS = 30_000

// http(s) only, domain names only (no IPs, no localhost)
const httpUrl = z.url({ protocol: /^https?$/, hostname: z.regexes.domain })

/** Read a response body with a hard size cap, aborting if exceeded. */
async function readWithSizeLimit(response: Response, maxBytes: number): Promise<ArrayBuffer> {
  const reader = response.body?.getReader()
  if (!reader) throw new ORPCError('BAD_GATEWAY', { message: 'Response has no body' })

  const chunks: Uint8Array[] = []
  let totalBytes = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    totalBytes += value.byteLength
    if (totalBytes > maxBytes) {
      await reader.cancel()
      throw new ORPCError('PAYLOAD_TOO_LARGE', {
        message: `Response exceeded ${maxBytes} bytes`,
      })
    }
    chunks.push(value)
  }

  // Concatenate into a single ArrayBuffer
  const result = new Uint8Array(totalBytes)
  let offset = 0
  for (const chunk of chunks) {
    result.set(chunk, offset)
    offset += chunk.byteLength
  }
  return result.buffer
}

/** Detect file metadata, store to R2, insert artifact row. */
async function ingest(
  env: Env,
  args: {
    source: string
    data: ArrayBuffer
    contentTypeHint: string
    tags?: Record<string, string | null>
  },
) {
  const id = uuidv7()
  const r2Key = `artifacts/${id}`
  const now = new Date()

  // Detect content type + dimensions from the raw bytes
  const { contentType, width, height } = await detectFile(args.data, args.contentTypeHint)

  // Store to R2 with the detected content type
  await env.ARTIFACTS_BUCKET.put(r2Key, args.data, {
    httpMetadata: { contentType },
  })

  // Insert artifact row
  const artifact: schema.NewArtifact = {
    id,
    r2Key,
    contentType,
    width,
    height,
    createdAt: now,
  }

  await db.insert(schema.artifacts).values(artifact)

  // Merge ig:source into user-provided tags
  const allTags = { ...args.tags, [TAG_KEYS.source]: args.source }
  await tagsService.upsert(id, allTags)

  console.log('[ingest]', 'artifact created', { id, contentType, width, height })

  return { ...artifact, tags: allTags }
}

export const ingestRouter = {
  // Upload a file directly
  upload: procedure
    .input(
      z.object({
        file: z.file(),
        tags: zTagsRecord.optional(),
      }),
    )
    .handler(async ({ input, context }) => {
      const file = input.file as File

      // Check size before buffering into memory
      if (file.size > MAX_INGEST_BYTES) {
        throw new ORPCError('PAYLOAD_TOO_LARGE', {
          message: `File too large: ${file.size} bytes (max ${MAX_INGEST_BYTES})`,
        })
      }

      return ingest(context.env, {
        source: file.name,
        data: await file.arrayBuffer(),
        contentTypeHint: file.type || 'application/octet-stream',
        tags: input.tags,
      })
    }),

  // Fetch a URL and store as artifact
  fetch: procedure
    .input(
      z.object({
        url: httpUrl,
        tags: zTagsRecord.optional(),
      }),
    )
    .handler(async ({ input, context }) => {
      const response = await fetch(input.url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
      if (!response.ok) {
        throw new ORPCError('BAD_GATEWAY', {
          message: `Fetch failed: ${response.status} ${response.statusText}`,
        })
      }

      // Stream with a hard size cap — doesn't trust content-length
      const data = await readWithSizeLimit(response, MAX_INGEST_BYTES)

      return ingest(context.env, {
        source: input.url,
        data,
        contentTypeHint: response.headers.get('content-type') || 'application/octet-stream',
        tags: input.tags,
      })
    }),
}
