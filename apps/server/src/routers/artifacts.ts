// Artifacts router — list, get, delete, tag management.

import { db } from '@ig/db'
import { runwareArtifacts, runwareGenerations, tags } from '@ig/db/schema'
import { ORPCError } from '@orpc/server'
import { and, desc, eq, getTableColumns, inArray, isNull, lt, or, sql } from 'drizzle-orm'
import { z } from 'zod'

import { apiKeyProcedure, publicProcedure } from '../orpc'
import { decodeCursor, encodeCursor, fetchTagsForArtifacts, paginationInput } from './utils'

const MAX_TAGS = 20
const MAX_KEY_LENGTH = 64
const MAX_VALUE_LENGTH = 256

export const artifactsRouter = {
  list: publicProcedure
    .route({ spec: { security: [] } })
    .input(paginationInput)
    .handler(async ({ input }) => {
      const { cursor, limit } = input
      const decoded = cursor ? decodeCursor(cursor) : null

      // Keyset condition: rows before the cursor position
      const cursorCondition = decoded
        ? or(
            lt(runwareArtifacts.createdAt, decoded.createdAt),
            and(
              eq(runwareArtifacts.createdAt, decoded.createdAt),
              lt(runwareArtifacts.id, decoded.id),
            ),
          )
        : undefined

      // Join generation so each artifact carries its full context
      const notDeleted = isNull(runwareArtifacts.deletedAt)
      const items = await db
        .select({
          ...getTableColumns(runwareArtifacts),
          generation: getTableColumns(runwareGenerations),
        })
        .from(runwareArtifacts)
        .innerJoin(runwareGenerations, eq(runwareArtifacts.generationId, runwareGenerations.id))
        .where(cursorCondition ? and(notDeleted, cursorCondition) : notDeleted)
        .orderBy(desc(runwareArtifacts.createdAt), desc(runwareArtifacts.id))
        .limit(limit + 1)

      // Extra row signals more pages exist
      const hasMore = items.length > limit
      if (hasMore) items.pop()

      // Merge tags onto each artifact
      const tagMap = await fetchTagsForArtifacts(items.map((i) => i.id))
      const itemsWithTags = items.map((i) => ({ ...i, tags: tagMap.get(i.id) ?? {} }))

      const lastItem = items[items.length - 1]
      const nextCursor = hasMore && lastItem ? encodeCursor(lastItem.createdAt, lastItem.id) : null

      return { items: itemsWithTags, nextCursor }
    }),

  get: publicProcedure
    .route({ spec: { security: [] } })
    .input(z.object({ id: z.string() }))
    .handler(async ({ input }) => {
      // Artifact + parent generation in one join
      const [row] = await db
        .select({
          ...getTableColumns(runwareArtifacts),
          generation: getTableColumns(runwareGenerations),
        })
        .from(runwareArtifacts)
        .innerJoin(runwareGenerations, eq(runwareArtifacts.generationId, runwareGenerations.id))
        .where(eq(runwareArtifacts.id, input.id))
        .limit(1)

      if (!row) return null

      const { generation, ...artifact } = row

      // Other artifacts from the same generation (excluding soft-deleted)
      const siblings = await db
        .select()
        .from(runwareArtifacts)
        .where(
          and(
            eq(runwareArtifacts.generationId, artifact.generationId),
            isNull(runwareArtifacts.deletedAt),
          ),
        )
        .orderBy(desc(runwareArtifacts.createdAt))

      // Fetch tags for this artifact and all siblings
      const allIds = siblings.map((s) => s.id)
      const tagMap = await fetchTagsForArtifacts(allIds)

      return {
        artifact: { ...artifact, tags: tagMap.get(artifact.id) ?? {} },
        generation,
        siblings: siblings.map((s) => ({ ...s, tags: tagMap.get(s.id) ?? {} })),
      }
    }),

  // Soft-delete: mark deletedAt, remove R2 blob + tags, keep D1 row
  delete: apiKeyProcedure
    .input(z.object({ id: z.string() }))
    .handler(async ({ input, context }) => {
      const [artifact] = await db
        .select({ id: runwareArtifacts.id, r2Key: runwareArtifacts.r2Key })
        .from(runwareArtifacts)
        .where(eq(runwareArtifacts.id, input.id))
        .limit(1)

      if (!artifact) {
        console.log('[artifacts:delete] not found', { id: input.id })
        return { id: input.id }
      }

      const now = new Date()

      // Soft-delete artifact row
      await db
        .update(runwareArtifacts)
        .set({ deletedAt: now })
        .where(eq(runwareArtifacts.id, input.id))

      // Delete R2 blob
      await context.env.GENERATIONS_BUCKET.delete(artifact.r2Key)

      // Delete tags
      await db.delete(tags).where(eq(tags.targetId, input.id))

      console.log('[artifacts:delete]', { id: input.id })
      return { id: input.id }
    }),

  tags: {
    // Upsert tags on an artifact (creates or updates values)
    set: apiKeyProcedure
      .input(
        z.object({
          artifactId: z.string(),
          tags: z.record(
            z.string().trim().min(1).max(MAX_KEY_LENGTH),
            z.string().max(MAX_VALUE_LENGTH).nullable(),
          ),
        }),
      )
      .handler(async ({ input }) => {
        const entries = Object.entries(input.tags)
        if (entries.length === 0) return { count: 0 }
        if (entries.length > MAX_TAGS)
          throw new ORPCError('BAD_REQUEST', {
            message: `Cannot exceed ${MAX_TAGS} tags per operation`,
          })

        console.log('[artifacts:tags:set] upserting', {
          artifactId: input.artifactId,
          count: entries.length,
        })

        const rows = entries.map(([tag, value]) => ({ tag, value, targetId: input.artifactId }))
        // D1 limit: 100 params per query, 3 columns per row → max 33 rows
        for (let i = 0; i < rows.length; i += 33) {
          await db
            .insert(tags)
            .values(rows.slice(i, i + 33))
            .onConflictDoUpdate({
              target: [tags.tag, tags.targetId],
              set: { value: sql`excluded.value` },
            })
        }

        return { count: entries.length }
      }),

    // Remove tags by key names
    remove: apiKeyProcedure
      .input(
        z.object({
          artifactId: z.string(),
          tags: z.array(z.string().trim().min(1).max(MAX_KEY_LENGTH)),
        }),
      )
      .handler(async ({ input }) => {
        if (input.tags.length === 0) return { count: 0 }

        console.log('[artifacts:tags:remove] removing', {
          artifactId: input.artifactId,
          tags: input.tags,
        })

        const deleted = await db
          .delete(tags)
          .where(and(eq(tags.targetId, input.artifactId), inArray(tags.tag, input.tags)))
          .returning()

        return { count: deleted.length }
      }),
  },
}
