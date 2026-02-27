// Shared router utilities — pagination, tag fetching, model enrichment.

import { db } from '@ig/db'
import { tags } from '@ig/db/schema'
import { inArray, sql } from 'drizzle-orm'
import { z } from 'zod'

import { type RunwareModel, getModels } from '../services/models'

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

// -- Slugs --

const SLUG_TAG = 'ig:slug'
const SLUG_MAX_LENGTH = 128

/** Slugify a string: lowercase, collapse non-alphanumerics to hyphens, truncate, trim edges. */
function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, SLUG_MAX_LENGTH)
    .replace(/^-+|-+$/g, '')
}

/** Extract first 12 hex chars from a UUIDv7 (full timestamp, 1ms resolution). */
function uuidPrefix(id: string) {
  return id.replace(/-/g, '').slice(0, 12)
}

/** If the tag record contains ig:slug, slugify and prefix with the artifact's UUIDv7 timestamp. */
function normalizeTagValues(artifactId: string, tags: Record<string, string | null>) {
  const slug = tags[SLUG_TAG]
  if (slug != null) {
    const base = slugify(slug)
    tags[SLUG_TAG] = `${uuidPrefix(artifactId)}-${base}`
  }
  return tags
}

// -- Tags --

export const MAX_TAGS = 20
export const MAX_KEY_LENGTH = 64
export const MAX_VALUE_LENGTH = 256

export const tagsSchema = z
  .record(z.string().trim().min(1).max(MAX_KEY_LENGTH), z.string().max(MAX_VALUE_LENGTH).nullable())
  .refine((tags) => Object.keys(tags).length <= MAX_TAGS, `Cannot exceed ${MAX_TAGS} tags`)

/** Upsert tags for an artifact. Normalizes ig:slug values and chunks for D1 limits. */
export async function upsertTags(artifactId: string, record: Record<string, string | null>) {
  normalizeTagValues(artifactId, record)
  const entries = Object.entries(record)
  if (entries.length === 0) return

  const rows = entries.map(([tag, value]) => ({ tag, value, targetId: artifactId }))
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
}

// -- Model enrichment --

/** Batch-read model data from KV and attach to items that have a `model` AIR field. */
export async function enrichWithModels<T extends { model: string | null }>(
  kv: KVNamespace,
  items: T[],
): Promise<(T & { modelData: RunwareModel | null })[]> {
  const airs = items.flatMap((item) => (item.model ? [item.model] : []))
  const modelMap = await getModels(kv, airs)
  return items.map((item) => ({
    ...item,
    modelData: item.model ? (modelMap.get(item.model) ?? null) : null,
  }))
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
