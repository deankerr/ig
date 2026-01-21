import { fal } from "@fal-ai/client"
import { db } from "@ig/db"
import { generations } from "@ig/db/schema"
import { and, desc, eq, lt } from "drizzle-orm"
import { v7 as uuidv7 } from "uuid"

import { apiKeyProcedure, publicProcedure } from "../index"
import {
  createGenerationInputSchema,
  deleteGenerationInputSchema,
  getGenerationInputSchema,
  listGenerationsQuerySchema,
  regenerateGenerationInputSchema,
  updateTagsInputSchema,
} from "../schemas/generations"

export const generationsRouter = {
  create: apiKeyProcedure.input(createGenerationInputSchema).handler(async ({ input, context }) => {
    const id = uuidv7()

    // Insert generation with pending status
    await db.insert(generations).values({
      id,
      status: "pending",
      endpoint: input.endpoint,
      input: input.input,
      tags: input.tags,
    })

    // Configure fal client with API key
    fal.config({ credentials: context.env.FAL_KEY })

    // Submit to fal.ai queue with webhook URL
    const webhookUrl = `${context.env.WEBHOOK_URL}?generation_id=${id}`
    const result = await fal.queue.submit(input.endpoint, {
      input: input.input,
      webhookUrl,
    })

    // Update generation with fal request ID
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

  list: publicProcedure.input(listGenerationsQuerySchema).handler(async ({ input }) => {
    const conditions = []

    if (input.status) {
      conditions.push(eq(generations.status, input.status))
    }

    if (input.endpoint) {
      conditions.push(eq(generations.endpoint, input.endpoint))
    }

    if (input.cursor) {
      // Cursor is the createdAt timestamp in ISO format
      const cursorDate = new Date(input.cursor)
      conditions.push(lt(generations.createdAt, cursorDate))
    }

    const results = await db
      .select()
      .from(generations)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(generations.createdAt))
      .limit(input.limit + 1) // Fetch one extra to determine if there's a next page

    // Filter by tags in-memory if specified
    let filtered = results
    if (input.tags && input.tags.length > 0) {
      filtered = results.filter((generation) => {
        const generationTags = generation.tags
        return input.tags!.every((tag) => generationTags.includes(tag))
      })
    }

    const hasMore = filtered.length > input.limit
    const items = hasMore ? filtered.slice(0, input.limit) : filtered
    const nextCursor = hasMore ? items[items.length - 1]?.createdAt.toISOString() : undefined

    return {
      items,
      nextCursor,
    }
  }),

  get: publicProcedure.input(getGenerationInputSchema).handler(async ({ input }) => {
    const result = await db.select().from(generations).where(eq(generations.id, input.id)).limit(1)

    if (result.length === 0) {
      return null
    }

    return result[0]
  }),

  updateTags: apiKeyProcedure.input(updateTagsInputSchema).handler(async ({ input }) => {
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

    // Remove specified tags, then add new ones
    const withoutRemoved = currentTags.filter((tag: string) => !input.remove.includes(tag))
    const newTags = [...new Set([...withoutRemoved, ...input.add])]

    await db.update(generations).set({ tags: newTags }).where(eq(generations.id, input.id))

    return { id: input.id, tags: newTags }
  }),

  delete: apiKeyProcedure.input(deleteGenerationInputSchema).handler(async ({ input, context }) => {
    const existing = await db
      .select()
      .from(generations)
      .where(eq(generations.id, input.id))
      .limit(1)

    const generation = existing[0]
    if (!generation) {
      return { deleted: false }
    }

    // Delete from R2 if status is ready
    if (generation.status === "ready") {
      const key = `generations/${input.id}`
      await context.env.GENERATIONS_BUCKET.delete(key)
    }

    // Delete from database
    await db.delete(generations).where(eq(generations.id, input.id))

    console.log("generation_deleted", { id: input.id })
    return { deleted: true }
  }),

  listTags: publicProcedure.handler(async () => {
    const results = await db.select({ tags: generations.tags }).from(generations)

    // Aggregate all unique tags
    const tagSet = new Set<string>()
    for (const row of results) {
      for (const tag of row.tags) {
        tagSet.add(tag)
      }
    }

    return { tags: [...tagSet].sort() }
  }),

  regenerate: apiKeyProcedure
    .input(regenerateGenerationInputSchema)
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

      // Create new generation with same input
      await db.insert(generations).values({
        id,
        status: "pending",
        endpoint: original.endpoint,
        input: original.input,
        tags: input.tags ?? original.tags,
      })

      // Configure fal client and submit
      fal.config({ credentials: context.env.FAL_KEY })

      const webhookUrl = `${context.env.WEBHOOK_URL}?generation_id=${id}`
      const result = await fal.queue.submit(original.endpoint, {
        input: original.input,
        webhookUrl,
      })

      // Update with fal request ID
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
