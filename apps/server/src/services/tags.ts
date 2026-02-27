// Tag service — single entry point for all tag validation, normalization, and persistence.

import { db } from '@ig/db'
import { tags } from '@ig/db/schema'
import { and, eq, inArray, sql } from 'drizzle-orm'
import * as R from 'remeda'
import { z } from 'zod'

// -- Constants --

const MAX_KEY_LENGTH = 64
const MAX_VALUE_LENGTH = 256
const MAX_TAGS_PER_OPERATION = 20

const SLUG_MAX_LENGTH = 128

/** Known system tag keys. */
export const TAG_KEYS = {
  slug: 'ig:slug',
  source: 'ig:source',
} as const

// -- Schema --

/** Tag record schema. Validates key/value constraints and max count per operation. */
export const zTagsRecord = z
  .record(
    z
      .string()
      .trim()
      .min(1, 'Tag key cannot be empty')
      .max(MAX_KEY_LENGTH, `Tag key cannot exceed ${MAX_KEY_LENGTH} characters`),
    z
      .string()
      .max(MAX_VALUE_LENGTH, `Tag value cannot exceed ${MAX_VALUE_LENGTH} characters`)
      .nullable(),
  )
  .refine(
    (r) => Object.keys(r).length <= MAX_TAGS_PER_OPERATION,
    `Cannot exceed ${MAX_TAGS_PER_OPERATION} tags per operation`,
  )

// -- Slugs --

/** Build a slug value: uuid prefix + slugified text. */
function buildSlug(artifactId: string, text: string) {
  const prefix = artifactId.replace(/-/g, '').slice(0, 12)
  const slug = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, SLUG_MAX_LENGTH)
    .replace(/^-+|-+$/g, '')
  return `${prefix}-${slug}`
}

// -- Mutations --

/** Upsert tags for an artifact. Validates, normalizes ig:slug, and chunks for D1 parameter limits. */
async function upsert(artifactId: string, record: Record<string, string | null>) {
  zTagsRecord.parse(record)

  // Normalize ig:slug if present
  const slug = record[TAG_KEYS.slug]
  if (slug != null) record[TAG_KEYS.slug] = buildSlug(artifactId, slug)

  const entries = Object.entries(record)
  if (entries.length === 0) return

  const rows = entries.map(([tag, value]) => ({ tag, value, targetId: artifactId }))
  // D1 limit: 100 params per query, 3 columns per row → max 33 rows
  for (const chunk of R.chunk(rows, 33)) {
    await db
      .insert(tags)
      .values(chunk)
      .onConflictDoUpdate({
        target: [tags.tag, tags.targetId],
        set: { value: sql`excluded.value` },
      })
  }
}

/** Remove tags by key names for an artifact. Returns the number of deleted tags. */
async function remove(artifactId: string, tagKeys: string[]) {
  if (tagKeys.length === 0) return 0
  const deleted = await db
    .delete(tags)
    .where(and(eq(tags.targetId, artifactId), inArray(tags.tag, tagKeys)))
    .returning()
  return deleted.length
}

// -- Queries --

type TagMap = Map<string, Record<string, string | null>>

/** Batch-fetch tags for a set of artifact IDs, grouped by artifact. */
async function fetchForArtifacts(artifactIds: string[]): Promise<TagMap> {
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

/** Convert tag rows from a relational query into a key-value record. */
function toRecord(rows: { tag: string; value: string | null }[]): Record<string, string | null> {
  const record: Record<string, string | null> = {}
  for (const row of rows) record[row.tag] = row.value
  return record
}

export const tagsService = { upsert, remove, fetchForArtifacts, toRecord }
