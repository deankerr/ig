import { db } from '@ig/db'
import { generations } from '@ig/db/schema'
import { and, desc, eq, lt, sql } from 'drizzle-orm'
import { z } from 'zod'

import { apiKeyProcedure, publicProcedure } from '../orpc'
import { create as createFal } from '../providers/fal'
import { create as createRunware } from '../providers/runware'

const PROVIDERS = ['fal', 'runware'] as const

const MAX_TAGS = 20
const SLUG_PREFIX_LENGTH = 12

const idSchema = z.uuidv7().trim()
const modelSchema = z.string().trim().min(1)
const cursorSchema = z.string().refine((s) => !Number.isNaN(Date.parse(s)), 'Invalid date format')

const tagSchema = z.string().trim().max(256, 'Tag cannot exceed 256 characters')

export type Tag = z.infer<typeof tagSchema>

// Trim tags, filter empties, dedupe
const tagsSchema = z
  .array(tagSchema)
  .transform((tags) => [...new Set(tags.filter(Boolean))])
  .refine((tags) => tags.length <= MAX_TAGS, `Cannot exceed ${MAX_TAGS} tags`)

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove diacritics
    .replace(/[^a-z0-9\s_/-]/g, '') // keep only allowed chars
    .trim()
    .replace(/\s+/g, '-') // spaces to hyphens
    .replace(/-+/g, '-') // collapse multiple hyphens
    .slice(0, 100)
}

// Accept any string, slugify it, return undefined if empty
const slugSchema = z.string().transform((s) => slugify(s) || undefined)

const providers = {
  fal: createFal,
  runware: createRunware,
} as const

function makeSlug(id: string, slugArg?: string) {
  return slugArg ? `${id.slice(0, SLUG_PREFIX_LENGTH)}-${slugArg}` : null
}

function mergeTags(...args: (string[] | null | undefined)[]) {
  return [...new Set(args.flatMap((a) => a ?? []))]
}

export const generationsRouter = {
  create: apiKeyProcedure
    .input(
      z.object({
        provider: z.enum(PROVIDERS),
        model: modelSchema,
        input: z.record(z.string(), z.unknown()),
        tags: tagsSchema.optional().default([]),
        slug: slugSchema.optional(),
        autoAspectRatio: z.boolean().optional(),
      }),
    )
    .handler(async ({ input: args, context }) => {
      const createFn = providers[args.provider]
      return createFn(context, {
        model: args.model,
        input: args.input,
        tags: args.tags,
        slug: args.slug,
        autoAspectRatio: args.autoAspectRatio,
      })
    }),

  list: publicProcedure
    .route({ spec: { security: [] } })
    .input(
      z.object({
        status: z.enum(['pending', 'ready', 'failed']).optional(),
        model: modelSchema.optional(),
        tags: tagsSchema.optional(),
        limit: z.number().int().min(1).max(100).optional().default(20),
        cursor: cursorSchema.optional(),
      }),
    )
    .handler(async ({ input }) => {
      const conditions = []

      if (input.status) {
        conditions.push(eq(generations.status, input.status))
      }

      if (input.model) {
        conditions.push(eq(generations.model, input.model))
      }

      if (input.cursor) {
        conditions.push(lt(generations.createdAt, new Date(input.cursor)))
      }

      if (input.tags && input.tags.length > 0) {
        for (const tag of input.tags) {
          conditions.push(
            sql`EXISTS (SELECT 1 FROM json_each(${generations.tags}) WHERE value = ${tag})`,
          )
        }
      }

      const results = await db
        .select()
        .from(generations)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(generations.createdAt))
        .limit(input.limit + 1)

      const hasMore = results.length > input.limit
      const items = hasMore ? results.slice(0, input.limit) : results
      const nextCursor = hasMore ? items[items.length - 1]?.createdAt.toISOString() : undefined

      return {
        items,
        nextCursor,
      }
    }),

  get: publicProcedure
    .route({ spec: { security: [] } })
    .input(z.object({ id: idSchema }))
    .handler(async ({ input: args }) => {
      const [generation] = await db
        .select()
        .from(generations)
        .where(eq(generations.id, args.id))
        .limit(1)

      return generation ?? null
    }),

  update: apiKeyProcedure
    .input(
      z.object({
        id: idSchema,
        add: tagsSchema.optional().default([]),
        remove: tagsSchema.optional().default([]),
        slug: slugSchema.optional(),
      }),
    )
    .handler(async ({ input: args }) => {
      const existing = await db
        .select({ tags: generations.tags, id: generations.id })
        .from(generations)
        .where(eq(generations.id, args.id))
        .limit(1)

      const generation = existing[0]
      if (!generation) {
        throw new Error('Generation not found')
      }

      const withoutRemoved = generation.tags.filter((tag: string) => !args.remove.includes(tag))
      const tags = mergeTags(withoutRemoved, args.add)

      if (tags.length > MAX_TAGS) {
        throw new Error(`Cannot exceed ${MAX_TAGS} tags per generation`)
      }

      const slug = makeSlug(generation.id, args.slug)

      await db
        .update(generations)
        .set({ tags, ...(slug && { slug }) })
        .where(eq(generations.id, args.id))

      console.log('generation_updated', { id: args.id, tags, slug })
      return { id: args.id, tags, slug }
    }),

  listModels: publicProcedure.route({ spec: { security: [] } }).handler(async () => {
    const results = await db
      .selectDistinct({ model: generations.model })
      .from(generations)
      .orderBy(generations.model)

    return { models: results.map((r) => r.model) }
  }),

  listTags: publicProcedure.route({ spec: { security: [] } }).handler(async () => {
    const results = await db
      .select({ tag: sql<string>`DISTINCT value` })
      .from(sql`${generations}, json_each(${generations.tags})`)
      .orderBy(sql`value`)

    return { tags: results.map((r) => r.tag) }
  }),

  delete: apiKeyProcedure
    .input(z.object({ id: idSchema }))
    .handler(async ({ input: args, context }) => {
      const [generation] = await db
        .select()
        .from(generations)
        .where(eq(generations.id, args.id))
        .limit(1)

      if (!generation) {
        return { deleted: false }
      }

      if (generation.status === 'ready') {
        await context.env.GENERATIONS_BUCKET.delete(`generations/${args.id}`)
      }

      await db.delete(generations).where(eq(generations.id, args.id))

      console.log('generation_deleted', { id: args.id })
      return { deleted: true }
    }),

  regenerate: apiKeyProcedure
    .input(
      z.object({
        id: idSchema,
        tags: tagsSchema.optional(),
        slug: slugSchema.optional(),
        autoAspectRatio: z.boolean().optional(),
      }),
    )
    .handler(async ({ input: args, context }) => {
      const existing = await db
        .select()
        .from(generations)
        .where(eq(generations.id, args.id))
        .limit(1)

      const original = existing[0]
      if (!original) {
        throw new Error('Generation not found')
      }

      const provider = original.provider as string
      const createFn = providers[provider as keyof typeof providers]
      if (!createFn) {
        throw new Error(`Invalid provider: ${provider}`)
      }

      // Merge tags with regenerate tracking
      const mergedTags = mergeTags(args.tags, original.tags, [`regenerate:${original.id}`])

      const result = await createFn(context, {
        model: original.model,
        input: original.input,
        tags: mergedTags,
        slug: args.slug,
        autoAspectRatio: args.autoAspectRatio,
      })

      console.log('generation_regenerated', {
        id: result.id,
        originalId: args.id,
        provider,
        model: original.model,
        requestId: result.requestId,
      })
      return { id: result.id, requestId: result.requestId, originalId: args.id }
    }),
}
