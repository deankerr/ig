import { db } from '@ig/db'
import { runwareArtifacts, runwareGenerations } from '@ig/db/schema'
import { and, desc, eq, getTableColumns, lt, or, sql } from 'drizzle-orm'
import { z } from 'zod'

import { publicProcedure } from '../orpc'

// Cursor format: {createdAt_ms}:{id}
function encodeCursor(createdAt: Date, id: string) {
  return `${createdAt.getTime()}:${id}`
}

function decodeCursor(cursor: string) {
  const colonIndex = cursor.indexOf(':')
  if (colonIndex === -1) return null
  const ms = Number(cursor.slice(0, colonIndex))
  const id = cursor.slice(colonIndex + 1)
  if (Number.isNaN(ms) || !id) return null
  return { createdAt: new Date(ms), id }
}

const paginationInput = z.object({
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(100).optional().default(20),
})

export const browseRouter = {
  listArtifacts: publicProcedure
    .route({ spec: { security: [] } })
    .input(paginationInput)
    .handler(async ({ input }) => {
      const { cursor, limit } = input
      const decoded = cursor ? decodeCursor(cursor) : null

      // Keyset pagination: createdAt DESC, id DESC
      const cursorCondition = decoded
        ? or(
            lt(runwareArtifacts.createdAt, decoded.createdAt),
            and(
              eq(runwareArtifacts.createdAt, decoded.createdAt),
              lt(runwareArtifacts.id, decoded.id),
            ),
          )
        : undefined

      const items = await db
        .select({
          ...getTableColumns(runwareArtifacts),
          duration:
            sql<number>`${runwareGenerations.completedAt} - ${runwareGenerations.createdAt}`.as(
              'duration',
            ),
        })
        .from(runwareArtifacts)
        .leftJoin(runwareGenerations, eq(runwareArtifacts.generationId, runwareGenerations.id))
        .where(cursorCondition)
        .orderBy(desc(runwareArtifacts.createdAt), desc(runwareArtifacts.id))
        .limit(limit + 1)

      const hasMore = items.length > limit
      if (hasMore) items.pop()

      const lastItem = items[items.length - 1]
      const nextCursor = hasMore && lastItem ? encodeCursor(lastItem.createdAt, lastItem.id) : null

      return { items, nextCursor }
    }),

  listGenerations: publicProcedure
    .route({ spec: { security: [] } })
    .input(paginationInput)
    .handler(async ({ input }) => {
      const { cursor, limit } = input
      const decoded = cursor ? decodeCursor(cursor) : null

      const cursorCondition = decoded
        ? or(
            lt(runwareGenerations.createdAt, decoded.createdAt),
            and(
              eq(runwareGenerations.createdAt, decoded.createdAt),
              lt(runwareGenerations.id, decoded.id),
            ),
          )
        : undefined

      const generations = await db
        .select()
        .from(runwareGenerations)
        .where(cursorCondition)
        .orderBy(desc(runwareGenerations.createdAt), desc(runwareGenerations.id))
        .limit(limit + 1)

      const hasMore = generations.length > limit
      if (hasMore) generations.pop()

      // Fetch artifacts for each generation (just enough for thumbnails)
      const generationIds = generations.map((g) => g.id)
      const artifacts =
        generationIds.length > 0
          ? await db
              .select({
                id: runwareArtifacts.id,
                generationId: runwareArtifacts.generationId,
                contentType: runwareArtifacts.contentType,
                createdAt: runwareArtifacts.createdAt,
              })
              .from(runwareArtifacts)
              .where(
                generationIds.length === 1
                  ? eq(runwareArtifacts.generationId, generationIds[0]!)
                  : or(...generationIds.map((id) => eq(runwareArtifacts.generationId, id))),
              )
              .orderBy(desc(runwareArtifacts.createdAt))
          : []

      // Group artifacts by generation
      const artifactsByGeneration = new Map<string, typeof artifacts>()
      for (const artifact of artifacts) {
        const existing = artifactsByGeneration.get(artifact.generationId) ?? []
        existing.push(artifact)
        artifactsByGeneration.set(artifact.generationId, existing)
      }

      const items = generations.map((g) => ({
        ...g,
        artifacts: artifactsByGeneration.get(g.id) ?? [],
      }))

      const lastItem = generations[generations.length - 1]
      const nextCursor = hasMore && lastItem ? encodeCursor(lastItem.createdAt, lastItem.id) : null

      return { items, nextCursor }
    }),

  getArtifact: publicProcedure
    .route({ spec: { security: [] } })
    .input(z.object({ id: z.string() }))
    .handler(async ({ input }) => {
      const [artifact] = await db
        .select()
        .from(runwareArtifacts)
        .where(eq(runwareArtifacts.id, input.id))
        .limit(1)

      if (!artifact) return null

      // Get parent generation
      const [generation] = await db
        .select()
        .from(runwareGenerations)
        .where(eq(runwareGenerations.id, artifact.generationId))
        .limit(1)

      // Get sibling artifacts
      const siblings = await db
        .select({
          id: runwareArtifacts.id,
          contentType: runwareArtifacts.contentType,
          createdAt: runwareArtifacts.createdAt,
        })
        .from(runwareArtifacts)
        .where(eq(runwareArtifacts.generationId, artifact.generationId))
        .orderBy(desc(runwareArtifacts.createdAt))

      return { artifact, generation: generation ?? null, siblings }
    }),

  getGeneration: publicProcedure
    .route({ spec: { security: [] } })
    .input(z.object({ id: z.string() }))
    .handler(async ({ input }) => {
      const [generation] = await db
        .select()
        .from(runwareGenerations)
        .where(eq(runwareGenerations.id, input.id))
        .limit(1)

      if (!generation) return null

      const artifacts = await db
        .select()
        .from(runwareArtifacts)
        .where(eq(runwareArtifacts.generationId, generation.id))
        .orderBy(desc(runwareArtifacts.createdAt))

      return { generation, artifacts }
    }),
}
