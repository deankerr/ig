import { fal } from "@fal-ai/client"
import { db } from "@ig/db"
import { generations, presets } from "@ig/db/schema"
import { and, desc, eq, lt, sql } from "drizzle-orm"
import { v7 as uuidv7 } from "uuid"
import { z } from "zod"

import { apiKeyProcedure, publicProcedure } from "../index"

const MAX_TAGS = 20
const SLUG_PREFIX_LENGTH = 8
const PRESET_PREFIX = "ig/"

const tagSchema = z
  .string()
  .trim()
  .min(1, "Tag cannot be empty")
  .max(256, "Tag cannot exceed 256 characters")

export type Tag = z.infer<typeof tagSchema>

const tagsSchema = z.array(tagSchema).max(MAX_TAGS, `Cannot exceed ${MAX_TAGS} tags`)

const slugSchema = z
  .string()
  .trim()
  .min(1, "Slug cannot be empty")
  .max(100, "Slug cannot exceed 100 characters")
  .regex(
    /^[a-z0-9_/-]+$/,
    "Slug must be lowercase alphanumeric with hyphens, underscores, and slashes",
  )

export const generationsRouter = {
  create: apiKeyProcedure
    .input(
      z.object({
        endpoint: z.string().min(1),
        input: z.record(z.string(), z.unknown()),
        tags: tagsSchema.optional().default([]),
        slug: slugSchema.optional(),
      }),
    )
    .handler(async ({ input, context }) => {
      const id = uuidv7()
      const slug = input.slug ? `${id.slice(0, SLUG_PREFIX_LENGTH)}-${input.slug}` : null

      // Resolve preset if endpoint starts with ig/
      let endpoint = input.endpoint
      let mergedInput = input.input
      let mergedTags = input.tags

      if (input.endpoint.startsWith(PRESET_PREFIX)) {
        const preset = await db
          .select()
          .from(presets)
          .where(eq(presets.name, input.endpoint))
          .limit(1)

        if (!preset[0]) {
          throw new Error(`Preset not found: ${input.endpoint}`)
        }

        endpoint = preset[0].endpoint
        mergedInput = { ...preset[0].input, ...input.input }
        mergedTags = [...new Set([...(preset[0].tags ?? []), ...input.tags])]
      }

      await db.insert(generations).values({
        id,
        status: "pending",
        endpoint,
        input: mergedInput,
        tags: mergedTags,
        slug,
      })

      fal.config({ credentials: context.env.FAL_KEY })

      const webhookUrl = `${context.env.WEBHOOK_URL}?generation_id=${id}`
      const result = await fal.queue.submit(endpoint, {
        input: mergedInput,
        webhookUrl,
      })

      await db
        .update(generations)
        .set({ providerRequestId: result.request_id })
        .where(eq(generations.id, id))

      console.log("generation_created", {
        id,
        slug,
        endpoint,
        preset: input.endpoint.startsWith(PRESET_PREFIX) ? input.endpoint : undefined,
        requestId: result.request_id,
      })
      return { id, slug, requestId: result.request_id }
    }),

  list: publicProcedure
    .route({ spec: { security: [] } })
    .input(
      z.object({
        status: z.enum(["pending", "ready", "failed"]).optional(),
        endpoint: z.string().optional(),
        tags: tagsSchema.optional(),
        limit: z.number().int().min(1).max(100).optional().default(20),
        cursor: z.string().optional(),
      }),
    )
    .handler(async ({ input }) => {
      const conditions = []

      if (input.status) {
        conditions.push(eq(generations.status, input.status))
      }

      if (input.endpoint) {
        conditions.push(eq(generations.endpoint, input.endpoint))
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
    .input(z.object({ id: z.string().min(1) }))
    .handler(async ({ input }) => {
      const result = await db
        .select()
        .from(generations)
        .where(eq(generations.id, input.id))
        .limit(1)

      if (result.length === 0) {
        return null
      }

      return result[0]
    }),

  update: apiKeyProcedure
    .input(
      z.object({
        id: z.string().min(1),
        add: tagsSchema.optional().default([]),
        remove: tagsSchema.optional().default([]),
        slug: slugSchema.optional(),
      }),
    )
    .handler(async ({ input }) => {
      const existing = await db
        .select({ tags: generations.tags, id: generations.id })
        .from(generations)
        .where(eq(generations.id, input.id))
        .limit(1)

      const generation = existing[0]
      if (!generation) {
        throw new Error("Generation not found")
      }

      const currentTags = generation.tags

      const withoutRemoved = currentTags.filter((tag: string) => !input.remove.includes(tag))
      const newTags = [...new Set([...withoutRemoved, ...input.add])]

      if (newTags.length > MAX_TAGS) {
        throw new Error(`Cannot exceed ${MAX_TAGS} tags per generation`)
      }

      const slug = input.slug
        ? `${generation.id.slice(0, SLUG_PREFIX_LENGTH)}-${input.slug}`
        : undefined

      await db
        .update(generations)
        .set({ tags: newTags, ...(slug && { slug }) })
        .where(eq(generations.id, input.id))

      return { id: input.id, tags: newTags, slug }
    }),

  listEndpoints: publicProcedure.route({ spec: { security: [] } }).handler(async () => {
    const results = await db
      .selectDistinct({ endpoint: generations.endpoint })
      .from(generations)
      .orderBy(generations.endpoint)

    return { endpoints: results.map((r) => r.endpoint) }
  }),

  listTags: publicProcedure.route({ spec: { security: [] } }).handler(async () => {
    const results = await db
      .select({ tag: sql<string>`DISTINCT value` })
      .from(sql`${generations}, json_each(${generations.tags})`)
      .orderBy(sql`value`)

    return { tags: results.map((r) => r.tag) }
  }),

  delete: apiKeyProcedure
    .input(z.object({ id: z.string().min(1) }))
    .handler(async ({ input, context }) => {
      const existing = await db
        .select()
        .from(generations)
        .where(eq(generations.id, input.id))
        .limit(1)

      const generation = existing[0]
      if (!generation) {
        return { deleted: false }
      }

      if (generation.status === "ready") {
        const key = `generations/${input.id}`
        await context.env.GENERATIONS_BUCKET.delete(key)
      }

      await db.delete(generations).where(eq(generations.id, input.id))

      console.log("generation_deleted", { id: input.id })
      return { deleted: true }
    }),

  regenerate: apiKeyProcedure
    .input(
      z.object({
        id: z.string().min(1),
        tags: tagsSchema.optional(),
      }),
    )
    .handler(async ({ input, context }) => {
      const existing = await db
        .select()
        .from(generations)
        .where(eq(generations.id, input.id))
        .limit(1)

      const original = existing[0]
      if (!original) {
        throw new Error("Generation not found")
      }

      const id = uuidv7()

      await db.insert(generations).values({
        id,
        status: "pending",
        endpoint: original.endpoint,
        input: original.input,
        tags: input.tags ?? original.tags,
      })

      fal.config({ credentials: context.env.FAL_KEY })

      const webhookUrl = `${context.env.WEBHOOK_URL}?generation_id=${id}`
      const result = await fal.queue.submit(original.endpoint, {
        input: original.input,
        webhookUrl,
      })

      await db
        .update(generations)
        .set({ providerRequestId: result.request_id })
        .where(eq(generations.id, id))

      console.log("generation_regenerated", {
        id,
        originalId: input.id,
        endpoint: original.endpoint,
        requestId: result.request_id,
      })
      return { id, requestId: result.request_id, originalId: input.id }
    }),
}
