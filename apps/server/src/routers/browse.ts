// Browse router — read-only queries for browsing generations and artifacts.
// All endpoints are public (no API key required).
// List endpoints use keyset/cursor pagination (createdAt DESC, id DESC).

import { db } from '@ig/db'
import { runwareArtifacts, runwareGenerations, tags } from '@ig/db/schema'
import { and, desc, eq, getTableColumns, inArray, lt, or } from 'drizzle-orm'
import { z } from 'zod'

import { publicProcedure } from '../orpc'

// -- Tag fetching helper --

type TagMap = Map<string, Record<string, string | null>>

/** Batch-fetch tags for a set of artifact IDs, grouped by artifact. */
async function fetchTagsForArtifacts(artifactIds: string[]): Promise<TagMap> {
  if (artifactIds.length === 0) return new Map()

  const rows = await db.select().from(tags).where(inArray(tags.targetId, artifactIds))

  const map: TagMap = new Map()
  for (const row of rows) {
    let entry = map.get(row.targetId)
    if (!entry) {
      entry = {}
      map.set(row.targetId, entry)
    }
    entry[row.tag] = row.value
  }
  return map
}

// Cursor: "{createdAt_ms}:{id}" — encodes position for keyset pagination
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
  // List artifacts with their parent generation, newest first
  listArtifacts: publicProcedure
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
      const items = await db
        .select({
          ...getTableColumns(runwareArtifacts),
          generation: getTableColumns(runwareGenerations),
        })
        .from(runwareArtifacts)
        .innerJoin(runwareGenerations, eq(runwareArtifacts.generationId, runwareGenerations.id))
        .where(cursorCondition)
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

  // List generations with their artifacts, newest first
  listGenerations: publicProcedure
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

      // Relational query auto-loads child artifacts
      const items = await db.query.runwareGenerations.findMany({
        where: cursorCondition,
        with: { artifacts: true },
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

  // Single artifact with its generation and sibling artifacts from the same batch
  getArtifact: publicProcedure
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

      // Other artifacts from the same generation
      const siblings = await db
        .select()
        .from(runwareArtifacts)
        .where(eq(runwareArtifacts.generationId, artifact.generationId))
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

  // Single generation with all its artifacts
  getGeneration: publicProcedure
    .route({ spec: { security: [] } })
    .input(z.object({ id: z.string() }))
    .handler(async ({ input }) => {
      const generation = await db.query.runwareGenerations.findFirst({
        where: eq(runwareGenerations.id, input.id),
        with: { artifacts: true },
      })
      if (!generation) return null

      // Fetch tags for all artifacts in the generation
      const tagMap = await fetchTagsForArtifacts(generation.artifacts.map((a) => a.id))
      return {
        ...generation,
        artifacts: generation.artifacts.map((a) => ({ ...a, tags: tagMap.get(a.id) ?? {} })),
      }
    }),
}
