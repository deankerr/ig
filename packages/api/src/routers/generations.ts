import { fal } from "@fal-ai/client"
import { db } from "@ig/db"
import { generations, presets } from "@ig/db/schema"
import { and, desc, eq, lt, sql } from "drizzle-orm"
import { v7 as uuidv7 } from "uuid"
import { z } from "zod"

import type { Context } from "../context"
import { apiKeyProcedure, publicProcedure } from "../index"
import { resolveAutoAspectRatio } from "../utils/auto-aspect-ratio"

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

type SubmitArgs = {
  id: string
  endpoint: string
  input: Record<string, unknown>
  env: Context["env"]
}

async function submitToProvider({ id, endpoint, input, env }: SubmitArgs) {
  const resolvedInput = { ...input }
  let preprocessingMetadata: Record<string, unknown> | undefined

  if (resolvedInput.prompt && resolvedInput.image_size === "auto") {
    const result = await resolveAutoAspectRatio(resolvedInput.prompt as string, env.AI)

    if (result.ok) {
      resolvedInput.image_size = result.data.imageSize
      console.log("auto_aspect_ratio_created", result.data)
    } else {
      resolvedInput.image_size = undefined
      console.log("auto_aspect_ratio_error", result.error)
    }

    preprocessingMetadata = {
      autoAspectRatio: { data: result.data },
    }
  }

  fal.config({ credentials: env.FAL_KEY })
  const webhookUrl = `${env.PUBLIC_URL}/webhooks/fal?generation_id=${id}`
  const { request_id } = await fal.queue.submit(endpoint, { input: resolvedInput, webhookUrl })

  await db
    .update(generations)
    .set({
      providerRequestId: request_id,
      ...(preprocessingMetadata && {
        providerMetadata: { ig_preprocessing: preprocessingMetadata },
      }),
    })
    .where(eq(generations.id, id))

  return { requestId: request_id }
}

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
        endpoint: z.string().min(1),
        input: z.record(z.string(), z.unknown()),
        tags: tagsSchema.optional().default([]),
        slug: slugSchema.optional(),
      }),
    )
    .handler(async ({ input: args, context }) => {
      const id = uuidv7()
      const slug = makeSlug(id, args.slug)

      let endpoint = args.endpoint
      let input = args.input
      let tags = args.tags

      // Resolve preset if endpoint starts with ig/
      if (args.endpoint.startsWith(PRESET_PREFIX)) {
        const preset = await db
          .select()
          .from(presets)
          .where(eq(presets.name, args.endpoint))
          .limit(1)

        if (!preset[0]) {
          throw new Error(`Preset not found: ${args.endpoint}`)
        }

        endpoint = preset[0].endpoint
        input = { ...preset[0].input, ...args.input }
        tags = mergeTags(preset[0].tags, args.tags)
      }

      await db.insert(generations).values({
        id,
        status: "pending",
        endpoint,
        input,
        tags,
        slug,
      })

      const { requestId } = await submitToProvider({
        id,
        endpoint,
        input,
        env: context.env,
      })

      console.log("generation_created", {
        id,
        slug,
        endpoint,
        preset: args.endpoint.startsWith(PRESET_PREFIX) ? args.endpoint : undefined,
        requestId,
      })
      return { id, slug, requestId }
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
        id: z.string().min(1),
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
        throw new Error("Generation not found")
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

      console.log("generation_updated", { id: args.id, tags, slug })
      return { id: args.id, tags, slug }
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
    .handler(async ({ input: args, context }) => {
      const [generation] = await db
        .select()
        .from(generations)
        .where(eq(generations.id, args.id))
        .limit(1)

      if (!generation) {
        return { deleted: false }
      }

      if (generation.status === "ready") {
        await context.env.GENERATIONS_BUCKET.delete(`generations/${args.id}`)
      }

      await db.delete(generations).where(eq(generations.id, args.id))

      console.log("generation_deleted", { id: args.id })
      return { deleted: true }
    }),

  regenerate: apiKeyProcedure
    .input(
      z.object({
        id: z.string().min(1),
        tags: tagsSchema.optional(),
        slug: slugSchema.optional(),
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
        throw new Error("Generation not found")
      }

      const id = uuidv7()
      const slug = makeSlug(id, args.slug)

      await db.insert(generations).values({
        id,
        status: "pending",
        endpoint: original.endpoint,
        input: original.input,
        tags: mergeTags(args.tags, original.tags, [`regenerate:${original.id}`]),
        slug,
      })

      const { requestId } = await submitToProvider({
        id,
        endpoint: original.endpoint,
        input: original.input,
        env: context.env,
      })

      console.log("generation_regenerated", {
        id,
        originalId: args.id,
        endpoint: original.endpoint,
        requestId,
      })
      return { id, requestId, originalId: args.id }
    }),
}
