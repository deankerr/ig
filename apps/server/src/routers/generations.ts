// Generations router — create, list, get, status, delete.

import { db } from '@ig/db'
import { artifacts, generations, tags } from '@ig/db/schema'
import { and, desc, eq, inArray, isNull, lt, or } from 'drizzle-orm'
import { z } from 'zod'

import type { Context } from '../context'
import { getRequest } from '../inference/request'
import { imageInferenceInput } from '../inference/schema'
import { submitRequest } from '../inference/submit'
import { procedure } from '../orpc'
import { dimensionsConfig } from '../services/dimensions'
import { tagsService, zTagsRecord } from '../services/tags'
import { decodeCursor, encodeCursor, enrichWithModels, paginationInput } from './utils'

// Flat input: inference fields + ig extensions (tags, sync, etc.) at the same level
const createSchema = imageInferenceInput.extend({
  dimensions: dimensionsConfig,
  tags: zTagsRecord.optional(),
  sync: z.boolean().optional().default(false),
})

export const generationsRouter = {
  create: procedure.input(createSchema).handler(async ({ input, context }) => {
    const { dimensions, tags, sync, ...inferenceInput } = input
    return submitRequest(context, { input: inferenceInput, dimensions, tags, sync })
  }),

  list: procedure.input(paginationInput).handler(async ({ input, context }) => {
    const { cursor, limit } = input
    const decoded = cursor ? decodeCursor(cursor) : null

    // Keyset condition: rows before the cursor position
    const cursorCondition = decoded
      ? or(
          lt(generations.createdAt, decoded.createdAt),
          and(eq(generations.createdAt, decoded.createdAt), lt(generations.id, decoded.id)),
        )
      : undefined

    // Relational query auto-loads child artifacts + tags (excluding soft-deleted)
    const items = await db.query.generations.findMany({
      where: cursorCondition,
      with: { artifacts: { where: isNull(artifacts.deletedAt), with: { tags: true } } },
      orderBy: [desc(generations.createdAt), desc(generations.id)],
      limit: limit + 1,
    })

    const hasMore = items.length > limit
    if (hasMore) items.pop()

    // Flatten tag rows into key-value records
    const itemsWithTags = items.map((g) => ({
      ...g,
      artifacts: g.artifacts.map((a) => ({ ...a, tags: tagsService.toRecord(a.tags) })),
    }))

    // Enrich with model data from KV
    const enriched = await enrichWithModels(context.env.CACHE, itemsWithTags)

    const lastItem = items[items.length - 1]
    const nextCursor = hasMore && lastItem ? encodeCursor(lastItem.createdAt, lastItem.id) : null

    return { items: enriched, nextCursor }
  }),

  get: procedure.input(z.object({ id: z.string() })).handler(async ({ input, context }) => {
    const generation = await db.query.generations.findFirst({
      where: eq(generations.id, input.id),
      with: { artifacts: { where: isNull(artifacts.deletedAt), with: { tags: true } } },
    })
    if (!generation) return null

    // Flatten tag rows into key-value records
    const withTags = {
      ...generation,
      artifacts: generation.artifacts.map((a) => ({ ...a, tags: tagsService.toRecord(a.tags) })),
    }

    // Enrich with model data from KV
    const [enriched] = await enrichWithModels(context.env.CACHE, [withTags])
    return enriched
  }),

  status: procedure.input(z.object({ id: z.uuid() })).handler(async ({ input, context }) => {
    const request = getRequest(context, input.id)
    return request.getState()
  }),

  // Hard-delete: destroy generation + all artifacts + R2 blobs + tags + DO state
  delete: procedure.input(z.object({ id: z.string() })).handler(async ({ input, context }) => {
    // Fetch artifacts for R2 cleanup
    const rows = await db
      .select({ id: artifacts.id, r2Key: artifacts.r2Key })
      .from(artifacts)
      .where(eq(artifacts.generationId, input.id))

    const artifactIds = rows.map((a) => a.id)

    // Delete tags for all artifacts
    if (artifactIds.length > 0) {
      await db.delete(tags).where(inArray(tags.targetId, artifactIds))
    }

    // Delete R2 blobs
    for (const row of rows) {
      await context.env.ARTIFACTS_BUCKET.delete(row.r2Key)
    }

    // Delete artifact rows
    await db.delete(artifacts).where(eq(artifacts.generationId, input.id))

    // Delete generation row
    await db.delete(generations).where(eq(generations.id, input.id))

    // Clear DO storage
    const ctx: Context = {
      env: context.env,
      headers: context.headers,
      waitUntil: context.waitUntil,
    }
    const request = getRequest(ctx, input.id)
    await request.destroy()

    console.log('[generations:delete]', {
      id: input.id,
      artifacts: artifactIds.length,
    })
    return { id: input.id }
  }),
}
