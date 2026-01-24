import { fal } from "@fal-ai/client"
import { db } from "@ig/db"
import { generations } from "@ig/db/schema"
import { and, desc, eq, lt, sql } from "drizzle-orm"
import { v7 as uuidv7 } from "uuid"
import { z } from "zod"

import { apiKeyProcedure, publicProcedure } from "../index"

const MAX_TAGS = 20

const tagSchema = z
  .string()
  .trim()
  .min(1, "Tag cannot be empty")
  .max(256, "Tag cannot exceed 256 characters")

export type Tag = z.infer<typeof tagSchema>

const tagsSchema = z.array(tagSchema).max(MAX_TAGS, `Cannot exceed ${MAX_TAGS} tags`)

export const generationsRouter = {
  create: apiKeyProcedure
    .input(
      z.object({
        endpoint: z.string().min(1),
        input: z.record(z.string(), z.unknown()),
        tags: tagsSchema.optional().default([]),
      })
    )
    .handler(async ({ input, context }) => {
      const id = uuidv7()

      await db.insert(generations).values({
        id,
        status: "pending",
        endpoint: input.endpoint,
        input: input.input,
        tags: input.tags,
      })

      fal.config({ credentials: context.env.FAL_KEY })

      const webhookUrl = `${context.env.WEBHOOK_URL}?generation_id=${id}`
      const result = await fal.queue.submit(input.endpoint, {
        input: input.input,
        webhookUrl,
      })

      await db
        .update(generations)
        .set({ providerRequestId: result.request_id })
        .where(eq(generations.id, id))

      console.log("generation_created", {
        id,
        endpoint: input.endpoint,
        requestId: result.request_id,
      })
      return { id, requestId: result.request_id }
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
      })
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
            sql`EXISTS (SELECT 1 FROM json_each(${generations.tags}) WHERE value = ${tag})`
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
    const result = await db.select().from(generations).where(eq(generations.id, input.id)).limit(1)

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
      })
    )
    .handler(async ({ input }) => {
      const existing = await db
        .select({ tags: generations.tags })
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

      await db.update(generations).set({ tags: newTags }).where(eq(generations.id, input.id))

      return { id: input.id, tags: newTags }
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
      })
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
