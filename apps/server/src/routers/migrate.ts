/**
 * One-time migration: transfers generations from the old prod-1 DB to the new schema.
 *
 * Old system (prod-1): single `generations` table, R2 keys at `generations/{id}`.
 * New system (prod-2): `generations` + `artifacts` + `tags` tables, R2 keys at `artifacts/{id}`.
 *
 * Transforms:
 *  - input.prompt → input.positivePrompt (normalised)
 *  - width/height determined from R2 image via CF Images binding
 *  - tags JSON array → tag rows (split on last colon)
 *  - slug column → ig:slug tag
 */

import { z } from 'zod'

import { apiKeyProcedure } from '../orpc'

const MIGRATE_TAG = ''

export const migrateRouter = {
  // Migrate a batch of old generations to the new schema
  run: apiKeyProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(200).optional().default(50),
        cursor: z.string().optional().default(''),
      }),
    )
    .handler(async ({ input, context }) => {
      const { limit, cursor } = input
      const oldDb = context.env.OLDDB
      const newDb = context.env.DATABASE
      const oldBucket = context.env.OLDBUCKET
      const newBucket = context.env.ARTIFACTS_BUCKET

      // Query old generations with the target tag, cursor-paginated by ID (UUIDv7 = time-ordered)
      const oldRows = await oldDb
        .prepare(
          `SELECT * FROM generations
           WHERE status = 'ready'
             AND id > ?
             AND EXISTS (SELECT 1 FROM json_each(tags) WHERE value = ?)
           ORDER BY id ASC
           LIMIT ?`,
        )
        .bind(cursor, MIGRATE_TAG, limit)
        .all()

      let migrated = 0
      let skipped = 0
      let lastId = cursor
      const errors: Array<{ id: string; error: string }> = []

      for (const row of oldRows.results) {
        const id = row.id as string
        lastId = id

        // Idempotent: skip if already in new DB
        const exists = await newDb
          .prepare('SELECT 1 FROM generations WHERE id = ?')
          .bind(id)
          .first()
        if (exists) {
          skipped++
          continue
        }

        try {
          // Normalise input: prompt → positivePrompt
          const inputObj = JSON.parse(row.input as string) as Record<string, unknown>
          if ('prompt' in inputObj) {
            if (!('positivePrompt' in inputObj)) {
              inputObj.positivePrompt = inputObj.prompt
            }
            delete inputObj.prompt
          }
          const normalizedInput = JSON.stringify(inputObj)

          // Extract seed/cost from old providerMetadata
          const meta = row.provider_metadata
            ? (JSON.parse(row.provider_metadata as string) as Record<string, unknown>)
            : {}
          const seed = typeof meta.seed === 'number' ? meta.seed : null
          const cost = typeof meta.cost === 'number' ? meta.cost : null

          // Parse old tags JSON array → new tag rows
          const oldTags = JSON.parse(row.tags as string) as string[]
          const tagStmts = []

          for (const t of oldTags) {
            const colonIdx = t.lastIndexOf(':')
            if (colonIdx > 0) {
              tagStmts.push(
                newDb
                  .prepare('INSERT INTO tags (tag, value, target_id) VALUES (?, ?, ?)')
                  .bind(t.slice(0, colonIdx), t.slice(colonIdx + 1), id),
              )
            } else {
              tagStmts.push(
                newDb
                  .prepare('INSERT INTO tags (tag, value, target_id) VALUES (?, ?, ?)')
                  .bind(t, null, id),
              )
            }
          }

          // Convert old slug column → ig:slug tag
          if (row.slug) {
            tagStmts.push(
              newDb
                .prepare('INSERT INTO tags (tag, value, target_id) VALUES (?, ?, ?)')
                .bind('ig:slug', row.slug, id),
            )
          }

          // Copy R2 object (idempotent — re-PUT is harmless)
          const oldR2Key = `generations/${id}`
          const newR2Key = `artifacts/${id}`
          const obj = await oldBucket.get(oldR2Key)
          if (!obj) {
            console.log('[migrate:run] R2 object missing, skipping', { id, key: oldR2Key })
            errors.push({ id, error: 'R2 object not found' })
            continue
          }

          await newBucket.put(newR2Key, obj.body, {
            httpMetadata: obj.httpMetadata,
          })

          // Determine width/height from the actual image via CF Images binding
          let width: number | null = null
          let height: number | null = null
          const stored = await newBucket.get(newR2Key)
          if (stored) {
            try {
              const info: any = await context.env.IMAGES.info(stored.body)
              width = info.width
              height = info.height
            } catch (infoErr) {
              console.log('[migrate:run] images.info failed, proceeding without dimensions', {
                id,
                error: infoErr,
              })
            }
          }

          // D1 batch: generation + artifact + tags (atomic)
          await newDb.batch([
            newDb
              .prepare(
                `INSERT INTO generations (id, model, input, batch, metadata, created_at, completed_at)
                 VALUES (?, ?, ?, 1, ?, ?, ?)`,
              )
              .bind(
                id,
                row.model,
                normalizedInput,
                row.provider_metadata ?? null,
                row.created_at,
                row.completed_at,
              ),
            newDb
              .prepare(
                `INSERT INTO artifacts (id, generation_id, model, r2_key, content_type, width, height, seed, cost, metadata, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              )
              .bind(
                id,
                id, // 1:1 — artifact ID = generation ID
                row.model,
                newR2Key,
                row.content_type,
                width,
                height,
                seed,
                cost,
                row.provider_metadata ?? null,
                row.created_at,
              ),
            ...tagStmts,
          ])

          migrated++
          console.log('[migrate:run] migrated', { id, width, height })
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          errors.push({ id, error: msg })
          console.error('[migrate:run] failed', { id, error: msg })
        }
      }

      const total = oldRows.results.length
      console.log('[migrate:run] batch complete', {
        migrated,
        skipped,
        errors: errors.length,
        total,
      })

      return {
        migrated,
        skipped,
        errors,
        total,
        cursor: lastId,
        hasMore: total === limit,
      }
    }),

  // Delete all migrated data from new DB + R2 (for re-running migration)
  deleteAll: apiKeyProcedure.handler(async ({ context }) => {
    const db = context.env.DATABASE
    const bucket = context.env.ARTIFACTS_BUCKET

    // Delete all R2 objects in batches
    let deleted = 0
    let cursor: string | undefined
    do {
      const listed = await bucket.list({ limit: 1000, cursor })
      if (listed.objects.length === 0) break

      await Promise.all(listed.objects.map((obj) => bucket.delete(obj.key)))
      deleted += listed.objects.length
      cursor = listed.truncated ? listed.cursor : undefined
    } while (cursor)

    // Clear D1 tables (tags first due to FK constraint)
    await db.batch([
      db.prepare('DELETE FROM tags'),
      db.prepare('DELETE FROM artifacts'),
      db.prepare('DELETE FROM generations'),
    ])

    console.log('[migrate:deleteAll]', { r2Objects: deleted })
    return { r2Objects: deleted }
  }),
}
