// Generations router — create, list, get, status, delete.

import { db } from '@ig/db'
import { artifacts, generations, tags } from '@ig/db/schema'
import { and, desc, eq, inArray, isNull, lt, or } from 'drizzle-orm'
import { z } from 'zod'

import type { Context } from '../context'
import { getRequest } from '../inference/request'
import { imageInferenceInput } from '../inference/schema'
import { submitRequest } from '../inference/submit'
import { apiKeyProcedure, publicProcedure } from '../orpc'
import { decodeCursor, encodeCursor, fetchTagsForArtifacts, paginationInput } from './utils'

const MAX_TAGS = 20
const MAX_KEY_LENGTH = 64
const MAX_VALUE_LENGTH = 256

const tagsSchema = z
  .record(z.string().trim().min(1).max(MAX_KEY_LENGTH), z.string().max(MAX_VALUE_LENGTH).nullable())
  .refine((tags) => Object.keys(tags).length <= MAX_TAGS, `Cannot exceed ${MAX_TAGS} tags`)

// Flat input: inference fields + ig extensions (tags, sync, etc.) at the same level
const createSchema = imageInferenceInput.extend({
  tags: tagsSchema.optional(),
  sync: z.boolean().optional().default(false),
})

export const generationsRouter = {
  create: apiKeyProcedure.input(createSchema).handler(async ({ input, context }) => {
    const { tags, sync, ...inferenceInput } = input
    return submitRequest(context, { input: inferenceInput, tags, sync })
  }),

  list: publicProcedure
    .route({ spec: { security: [] } })
    .input(paginationInput)
    .handler(async ({ input }) => {
      const { cursor, limit } = input
      const decoded = cursor ? decodeCursor(cursor) : null

      // Keyset condition: rows before the cursor position
      const cursorCondition = decoded
        ? or(
            lt(generations.createdAt, decoded.createdAt),
            and(eq(generations.createdAt, decoded.createdAt), lt(generations.id, decoded.id)),
          )
        : undefined

      // Relational query auto-loads child artifacts (excluding soft-deleted)
      const items = await db.query.generations.findMany({
        where: cursorCondition,
        with: { artifacts: { where: isNull(artifacts.deletedAt) } },
        orderBy: [desc(generations.createdAt), desc(generations.id)],
        limit: limit + 1,
      })

      const hasMore = items.length > limit
      if (hasMore) items.pop()

      // Collect all artifact IDs and batch-fetch tags
      const allArtifactIds = items.flatMap((g) => g.artifacts.map((a) => a.id))
      const tagMap = await fetchTagsForArtifacts(allArtifactIds)
      const itemsWithTags = items.map((g) => ({
        ...g,
        artifacts: g.artifacts.map((a) => ({ ...a, tags: tagMap.get(a.id) ?? {} })),
      }))

      const lastItem = items[items.length - 1]
      const nextCursor = hasMore && lastItem ? encodeCursor(lastItem.createdAt, lastItem.id) : null

      return { items: itemsWithTags, nextCursor }
    }),

  get: publicProcedure
    .route({ spec: { security: [] } })
    .input(z.object({ id: z.string() }))
    .handler(async ({ input }) => {
      const generation = await db.query.generations.findFirst({
        where: eq(generations.id, input.id),
        with: { artifacts: { where: isNull(artifacts.deletedAt) } },
      })
      if (!generation) return null

      // Fetch tags for all artifacts in the generation
      const tagMap = await fetchTagsForArtifacts(generation.artifacts.map((a) => a.id))
      return {
        ...generation,
        artifacts: generation.artifacts.map((a) => ({ ...a, tags: tagMap.get(a.id) ?? {} })),
      }
    }),

  status: publicProcedure
    .route({ spec: { security: [] } })
    .input(z.object({ id: z.uuid() }))
    .handler(async ({ input, context }) => {
      const request = getRequest(context, input.id)
      return request.getState()
    }),

  // Hard-delete: destroy generation + all artifacts + R2 blobs + tags + DO state
  delete: apiKeyProcedure
    .input(z.object({ id: z.string() }))
    .handler(async ({ input, context }) => {
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
