import { db } from "@ig/db"
import { models } from "@ig/db/schema"
import { eq, isNotNull, sql } from "drizzle-orm"
import { up, isResponseError } from "up-fetch"
import z from "zod"
import * as R from "remeda"

const MODEL_BATCH_SIZE = 100
const PRICING_QUEUE_BATCH_SIZE = 10

// Zod schemas matching the actual fal.ai OpenAPI spec
const FalModelMetadataSchema = z.object({
  display_name: z.string(),
  category: z.string(),
  description: z.string(),
  status: z.enum(["active", "deprecated"]),
  tags: z.array(z.string()),
  updated_at: z.string(),
  is_favorited: z.boolean().nullable(),
  thumbnail_url: z.string(),
  model_url: z.string(),
  date: z.string(),
  highlighted: z.boolean(),
  pinned: z.boolean(),
  license_type: z.enum(["commercial", "research", "private"]).optional(),
  kind: z.enum(["inference", "training"]).optional(),
  duration_estimate: z.number().optional(),
  github_url: z.string().optional(),
  thumbnail_animated_url: z.string().optional(),
  group: z
    .object({
      key: z.string(),
      label: z.string(),
    })
    .optional(),
  training_endpoint_ids: z.array(z.string()).optional(),
  inference_endpoint_ids: z.array(z.string()).optional(),
  stream_url: z.string().optional(),
})

const FalModelSchema = z.object({
  endpoint_id: z.string(),
  metadata: FalModelMetadataSchema.optional(),
})

const FalModelsResponseSchema = z.object({
  models: z.array(FalModelSchema),
  next_cursor: z.string().nullable(),
  has_more: z.boolean(),
})

const FalPricingItemSchema = z.object({
  endpoint_id: z.string(),
  unit_price: z.number(),
  unit: z.string(),
  currency: z.string(),
})

const FalPricingResponseSchema = z.object({
  prices: z.array(FalPricingItemSchema).min(1),
  next_cursor: z.string().nullable(),
  has_more: z.boolean(),
})

type FalModel = z.infer<typeof FalModelSchema>

function createFalClient(key: string) {
  return up(fetch, () => ({
    baseUrl: "https://api.fal.ai/v1",
    headers: { Authorization: `Key ${key}` },
    retry: {
      attempts: 5,
      delay: (ctx) => ctx.attempt ** 2 * 1000,
    },
  }))
}

type FalClient = ReturnType<typeof createFalClient>

// Queue message type
export type ModelSyncMessage = { type: "fetch_pricing"; endpointIds: string[] }

// Fetch all models from fal.ai
async function fetchAllModels(fal: FalClient): Promise<FalModel[]> {
  const results: FalModel[] = []
  let cursor = ""

  while (true) {
    const data = await fal("/models", {
      method: "GET",
      params: { limit: MODEL_BATCH_SIZE, cursor },
      schema: FalModelsResponseSchema,
    })

    results.push(...data.models)

    if (!data.next_cursor) break
    cursor = data.next_cursor
  }

  return results
}

// Start sync: fetch models, upsert them, enqueue pricing jobs
export async function startModelSync(args: {
  falKey: string
  queue: { send(message: ModelSyncMessage): Promise<void> }
}) {
  const { falKey, queue } = args
  const fal = createFalClient(falKey)

  // Fetch all models (fast operation)
  const falModels = await fetchAllModels(fal)

  // Prepare records for upsert (metadata only, no pricing fields)
  const records = falModels
    .filter((m) => m.metadata)
    .map((m) => {
      const meta = m.metadata!
      return {
        endpointId: m.endpoint_id,
        displayName: meta.display_name,
        category: meta.category,
        description: meta.description,
        status: meta.status,
        tags: meta.tags,
        upstreamUpdatedAt: new Date(meta.updated_at),
        isFavorited: meta.is_favorited,
        thumbnailUrl: meta.thumbnail_url,
        modelUrl: meta.model_url,
        upstreamCreatedAt: new Date(meta.date),
        thumbnailAnimatedUrl: meta.thumbnail_animated_url ?? null,
        githubUrl: meta.github_url ?? null,
        licenseType: meta.license_type ?? null,
        groupKey: meta.group?.key ?? null,
        groupLabel: meta.group?.label ?? null,
        kind: meta.kind ?? "inference",
        durationEstimate: meta.duration_estimate ?? null,
      }
    })

  // Upsert all models using batch to avoid D1's 1000 query/invocation limit
  for (const chunk of R.chunk(records, MODEL_BATCH_SIZE)) {
    const batch = chunk.map((record) =>
      db.insert(models).values(record).onConflictDoUpdate({
        target: models.endpointId,
        set: record,
      }),
    )

    if (R.hasAtLeast(batch, 1)) {
      await db.batch(batch)
    }
  }

  for (const chunk of R.chunk(records, PRICING_QUEUE_BATCH_SIZE)) {
    await queue.send({
      type: "fetch_pricing",
      endpointIds: chunk.map(({ endpointId }) => endpointId),
    })
  }

  return { found: falModels.length }
}

// * Model Sync Queue
// NOTE: fal will failed an entire price request batch if a single item returns a 404
export async function processModelSyncMessage(args: { message: ModelSyncMessage; falKey: string }) {
  const { message, falKey } = args
  const fal = createFalClient(falKey)

  async function fetchPrices(endpointIds: string[]) {
    return await fal("/models/pricing", {
      method: "GET",
      params: { endpoint_id: endpointIds },
      schema: FalPricingResponseSchema,
      retry: {
        attempts: 5,
        delay: (ctx) => ctx.attempt ** 2 * 1000,
        when: (ctx) => {
          return ctx.response?.status !== 404
        },
      },
    })
  }

  try {
    // Try batch fetch first
    const data = await fetchPrices(message.endpointIds)

    const batch = data.prices.map(({ endpoint_id, ...pricing }) => {
      return db
        .update(models)
        .set({
          unitPrice: pricing.unit_price,
          unit: pricing.unit,
          currency: pricing.currency,
          syncError: null,
        })
        .where(eq(models.endpointId, endpoint_id))
    })

    if (R.hasAtLeast(batch, 1)) {
      await db.batch(batch)
    }
  } catch {
    // Batch failed (likely 404 for one model), try individually
    for (const endpointId of message.endpointIds) {
      try {
        const data = await fetchPrices([endpointId])
        const pricing = data.prices[0] // min(1) ensured by zod
        if (!pricing) continue

        await db
          .update(models)
          .set({
            unitPrice: pricing.unit_price,
            unit: pricing.unit,
            currency: pricing.currency,
            syncError: null,
          })
          .where(eq(models.endpointId, endpointId))
      } catch (error) {
        if (isResponseError(error)) {
          // fal has no pricing for this model
          if (error.status === 404) {
            await db
              .update(models)
              .set({
                unitPrice: null,
                unit: null,
                currency: null,
                syncError: error.message,
              })
              .where(eq(models.endpointId, endpointId))
          }
        }

        // unknown error, leave existing pricing in place
        await db
          .update(models)
          .set({
            syncError: error instanceof Error ? error.message : String(error),
          })
          .where(eq(models.endpointId, endpointId))
      }
    }
  }
}

// Get sync status - counts of models with/without pricing and errors
export async function getSyncStatus(): Promise<{
  total: number
  withPricing: number
  withoutPricing: number
  withErrors: number
}> {
  const [totalResult, withPricingResult, withErrorsResult] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(models),
    db.select({ count: sql<number>`count(*)` }).from(models).where(isNotNull(models.unitPrice)),
    db.select({ count: sql<number>`count(*)` }).from(models).where(isNotNull(models.syncError)),
  ])

  const total = totalResult[0]?.count ?? 0
  const withPricing = withPricingResult[0]?.count ?? 0
  const withErrors = withErrorsResult[0]?.count ?? 0

  return {
    total,
    withPricing,
    withoutPricing: total - withPricing,
    withErrors,
  }
}
