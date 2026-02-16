// Artifacts router — list, get, delete, tag management.

import { db } from '@ig/db'
import { artifacts, generations, tags } from '@ig/db/schema'
import { ORPCError } from '@orpc/server'
import { and, desc, eq, getTableColumns, inArray, isNull, lt, or } from 'drizzle-orm'
import { z } from 'zod'

import { procedure } from '../orpc'
import {
  decodeCursor,
  encodeCursor,
  enrichWithModels,
  fetchTagsForArtifacts,
  paginationInput,
  upsertTags,
} from './utils'

const MAX_TAGS = 20
const MAX_KEY_LENGTH = 64
const MAX_VALUE_LENGTH = 256

// Shared: fetch an artifact by ID with generation, siblings, tags, and model data
async function getArtifactById(id: string, kv: KVNamespace) {
  const [row] = await db
    .select({
      ...getTableColumns(artifacts),
      generation: getTableColumns(generations),
    })
    .from(artifacts)
    .innerJoin(generations, eq(artifacts.generationId, generations.id))
    .where(eq(artifacts.id, id))
    .limit(1)

  if (!row) return null

  const { generation, ...artifact } = row

  // Other artifacts from the same generation (excluding soft-deleted)
  const siblings = await db
    .select()
    .from(artifacts)
    .where(and(eq(artifacts.generationId, artifact.generationId), isNull(artifacts.deletedAt)))
    .orderBy(desc(artifacts.createdAt))

  // Fetch tags for this artifact and all siblings
  const allIds = siblings.map((s) => s.id)
  const tagMap = await fetchTagsForArtifacts(allIds)

  // Enrich artifact and siblings with model data from KV
  const allItems = [artifact, ...siblings]
  const enrichedItems = await enrichWithModels(kv, allItems)
  const enrichedArtifact = enrichedItems[0]!
  const enrichedSiblings = enrichedItems.slice(1)

  // Enrich generation too
  const enrichedGeneration = (await enrichWithModels(kv, [generation]))[0]!

  return {
    artifact: { ...enrichedArtifact, tags: tagMap.get(artifact.id) ?? {} },
    generation: enrichedGeneration,
    siblings: enrichedSiblings.map((s) => ({ ...s, tags: tagMap.get(s.id) ?? {} })),
  }
}

export const artifactsRouter = {
  list: procedure.input(paginationInput).handler(async ({ input, context }) => {
    const { cursor, limit } = input
    const decoded = cursor ? decodeCursor(cursor) : null

    // Keyset condition: rows before the cursor position
    const cursorCondition = decoded
      ? or(
          lt(artifacts.createdAt, decoded.createdAt),
          and(eq(artifacts.createdAt, decoded.createdAt), lt(artifacts.id, decoded.id)),
        )
      : undefined

    // Join generation so each artifact carries its full context
    const notDeleted = isNull(artifacts.deletedAt)
    const items = await db
      .select({
        ...getTableColumns(artifacts),
        generation: getTableColumns(generations),
      })
      .from(artifacts)
      .innerJoin(generations, eq(artifacts.generationId, generations.id))
      .where(cursorCondition ? and(notDeleted, cursorCondition) : notDeleted)
      .orderBy(desc(artifacts.createdAt), desc(artifacts.id))
      .limit(limit + 1)

    // Extra row signals more pages exist
    const hasMore = items.length > limit
    if (hasMore) items.pop()

    // Merge tags onto each artifact
    const tagMap = await fetchTagsForArtifacts(items.map((i) => i.id))
    const itemsWithTags = items.map((i) => ({ ...i, tags: tagMap.get(i.id) ?? {} }))

    // Enrich with model data from KV
    const enriched = await enrichWithModels(context.env.CACHE, itemsWithTags)

    const lastItem = items[items.length - 1]
    const nextCursor = hasMore && lastItem ? encodeCursor(lastItem.createdAt, lastItem.id) : null

    return { items: enriched, nextCursor }
  }),

  get: procedure.input(z.object({ id: z.string() })).handler(async ({ input, context }) => {
    return getArtifactById(input.id, context.env.CACHE)
  }),

  // List artifacts matching a tag key and optional value
  listByTag: procedure
    .input(
      z.object({
        tag: z.string(),
        value: z.string().optional(),
        limit: z.number().int().min(1).max(100).optional().default(20),
      }),
    )
    .handler(async ({ input, context }) => {
      // Find artifact IDs matching the tag
      const tagCondition =
        input.value != null
          ? and(eq(tags.tag, input.tag), eq(tags.value, input.value))
          : eq(tags.tag, input.tag)

      const tagRows = await db
        .select({ targetId: tags.targetId })
        .from(tags)
        .where(tagCondition)
        .limit(input.limit)

      if (tagRows.length === 0) return { items: [] }

      const artifactIds = tagRows.map((r) => r.targetId)

      // Fetch artifacts with generation context
      const items = await db
        .select({
          ...getTableColumns(artifacts),
          generation: getTableColumns(generations),
        })
        .from(artifacts)
        .innerJoin(generations, eq(artifacts.generationId, generations.id))
        .where(and(inArray(artifacts.id, artifactIds), isNull(artifacts.deletedAt)))
        .orderBy(desc(artifacts.createdAt))

      // Merge tags and enrich with model data
      const tagMap = await fetchTagsForArtifacts(items.map((i) => i.id))
      const itemsWithTags = items.map((i) => ({ ...i, tags: tagMap.get(i.id) ?? {} }))
      const enriched = await enrichWithModels(context.env.CACHE, itemsWithTags)
      return { items: enriched }
    }),

  // Soft-delete: mark deletedAt, remove R2 blob + tags, keep D1 row
  delete: procedure.input(z.object({ id: z.string() })).handler(async ({ input, context }) => {
    const [artifact] = await db
      .select({ id: artifacts.id, r2Key: artifacts.r2Key })
      .from(artifacts)
      .where(eq(artifacts.id, input.id))
      .limit(1)

    if (!artifact) {
      console.log('[artifacts:delete] not found', { id: input.id })
      return { id: input.id }
    }

    const now = new Date()

    // Soft-delete artifact row
    await db.update(artifacts).set({ deletedAt: now }).where(eq(artifacts.id, input.id))

    // Delete R2 blob
    await context.env.ARTIFACTS_BUCKET.delete(artifact.r2Key)

    // Delete tags
    await db.delete(tags).where(eq(tags.targetId, input.id))

    console.log('[artifacts:delete]', { id: input.id })
    return { id: input.id }
  }),

  tags: {
    // Upsert tags on an artifact (creates or updates values)
    set: procedure
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
        const count = Object.keys(input.tags).length
        if (count === 0) return { count: 0 }
        if (count > MAX_TAGS)
          throw new ORPCError('BAD_REQUEST', {
            message: `Cannot exceed ${MAX_TAGS} tags per operation`,
          })

        console.log('[artifacts:tags:set] upserting', { artifactId: input.artifactId, count })
        await upsertTags(input.artifactId, input.tags)

        return { count }
      }),

    // Remove tags by key names
    remove: procedure
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
