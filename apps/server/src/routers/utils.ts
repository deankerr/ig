// Shared router utilities — pagination and tag fetching.

import { db } from '@ig/db'
import { tags } from '@ig/db/schema'
import { inArray } from 'drizzle-orm'
import { z } from 'zod'

// -- Pagination --

export const paginationInput = z.object({
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(100).optional().default(20),
})

// Cursor: "{createdAt_ms}:{id}" — encodes position for keyset pagination
export function encodeCursor(createdAt: Date, id: string) {
  return `${createdAt.getTime()}:${id}`
}

export function decodeCursor(cursor: string) {
  const colonIndex = cursor.indexOf(':')
  if (colonIndex === -1) return null
  const ms = Number(cursor.slice(0, colonIndex))
  const id = cursor.slice(colonIndex + 1)
  if (Number.isNaN(ms) || !id) return null
  return { createdAt: new Date(ms), id }
}

// -- Tags --

type TagMap = Map<string, Record<string, string | null>>

/** Batch-fetch tags for a set of artifact IDs, grouped by artifact. */
export async function fetchTagsForArtifacts(artifactIds: string[]): Promise<TagMap> {
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
