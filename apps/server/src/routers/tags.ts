import { db } from '@ig/db'
import { tags } from '@ig/db/schema'
import { ORPCError } from '@orpc/server'
import { and, eq, inArray, sql } from 'drizzle-orm'
import { z } from 'zod'

import { apiKeyProcedure } from '../orpc'

const MAX_TAGS = 20
const MAX_KEY_LENGTH = 64
const MAX_VALUE_LENGTH = 256

export const tagsRouter = {
  // Upsert tags on an artifact (creates or updates values)
  setTags: apiKeyProcedure
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

      console.log('[tags:setTags] upserting', {
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
  removeTags: apiKeyProcedure
    .input(
      z.object({
        artifactId: z.string(),
        tags: z.array(z.string().trim().min(1).max(MAX_KEY_LENGTH)),
      }),
    )
    .handler(async ({ input }) => {
      if (input.tags.length === 0) return { count: 0 }

      console.log('[tags:removeTags] removing', {
        artifactId: input.artifactId,
        tags: input.tags,
      })

      const deleted = await db
        .delete(tags)
        .where(and(eq(tags.targetId, input.artifactId), inArray(tags.tag, input.tags)))
        .returning()

      return { count: deleted.length }
    }),
}
