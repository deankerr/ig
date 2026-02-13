// Generations router — create, list, get, status, delete.

import { db } from '@ig/db'
import { runwareArtifacts, runwareGenerations, tags } from '@ig/db/schema'
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
            lt(runwareGenerations.createdAt, decoded.createdAt),
            and(
              eq(runwareGenerations.createdAt, decoded.createdAt),
              lt(runwareGenerations.id, decoded.id),
            ),
          )
        : undefined

      // Relational query auto-loads child artifacts (excluding soft-deleted)
      const items = await db.query.runwareGenerations.findMany({
        where: cursorCondition,
        with: { artifacts: { where: isNull(runwareArtifacts.deletedAt) } },
        orderBy: [desc(runwareGenerations.createdAt), desc(runwareGenerations.id)],
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
      const generation = await db.query.runwareGenerations.findFirst({
        where: eq(runwareGenerations.id, input.id),
        with: { artifacts: { where: isNull(runwareArtifacts.deletedAt) } },
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
      const artifacts = await db
        .select({ id: runwareArtifacts.id, r2Key: runwareArtifacts.r2Key })
        .from(runwareArtifacts)
        .where(eq(runwareArtifacts.generationId, input.id))

      const artifactIds = artifacts.map((a) => a.id)

      // Delete tags for all artifacts
      if (artifactIds.length > 0) {
        await db.delete(tags).where(inArray(tags.targetId, artifactIds))
      }

      // Delete R2 blobs
      for (const artifact of artifacts) {
        await context.env.GENERATIONS_BUCKET.delete(artifact.r2Key)
      }

      // Delete artifact rows
      await db.delete(runwareArtifacts).where(eq(runwareArtifacts.generationId, input.id))

      // Delete generation row
      await db.delete(runwareGenerations).where(eq(runwareGenerations.id, input.id))

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
