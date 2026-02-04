import { db } from "@ig/db"
import { models } from "@ig/db/schema"
import { eq, isNotNull, isNull, or, gt, lt } from "drizzle-orm"
import { up, isResponseError } from "up-fetch"
import z from "zod"
import * as R from "remeda"

const MODEL_BATCH_SIZE = 100
export const PRICING_BATCH_SIZE = 10

// Sync thresholds - configurable via workflow params
export const SYNC_THRESHOLDS = {
  NEW_MODEL_DAYS: 7, // models created within this period always refetch pricing
  STALE_PRICING_DAYS: 30, // refetch pricing older than this
} as const

export type SyncParams = {
  newModelDays?: number
  stalePricingDays?: number
}

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

export type FalModel = z.infer<typeof FalModelSchema>

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

// Fetch all models from fal.ai - used by workflow
export async function fetchAllModels(falKey: string): Promise<FalModel[]> {
  const fal = createFalClient(falKey)
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

// Upsert models to database - used by workflow
export async function upsertModels(falModels: FalModel[]) {
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

  return { upserted: records.length }
}

// Query models needing pricing - smart filtering for workflow
export async function queryModelsNeedingPricing(params: SyncParams = {}) {
  const {
    newModelDays = SYNC_THRESHOLDS.NEW_MODEL_DAYS,
    stalePricingDays = SYNC_THRESHOLDS.STALE_PRICING_DAYS,
  } = params

  const now = Date.now()
  const newModelThreshold = new Date(now - newModelDays * 24 * 60 * 60 * 1000)
  const stalePricingThreshold = new Date(now - stalePricingDays * 24 * 60 * 60 * 1000)

  // Queue pricing when:
  // 1. No pricing yet (unitPrice IS NULL)
  // 2. Has error (syncError IS NOT NULL) - retry, 404 might be temporary
  // 3. New model (upstreamCreatedAt within threshold) - always refetch
  // 4. Stale pricing (pricingSyncedAt older than threshold)
  // 5. Never synced pricing (pricingSyncedAt IS NULL) - catches legacy data
  const m = await db
    .select({ endpointId: models.endpointId })
    .from(models)
    .where(
      or(
        isNull(models.unitPrice),
        isNotNull(models.syncError),
        gt(models.upstreamCreatedAt, newModelThreshold),
        lt(models.pricingSyncedAt, stalePricingThreshold),
        isNull(models.pricingSyncedAt),
      ),
    )

  return m.map(({ endpointId }) => endpointId)
}

// Fetch pricing for a batch of models
// NOTE: fal will return a single 404 error any one of the endpoints in the batch are not found
//  - try a batch first, if it fails, try each individually to isolate the problematic endpoint
export async function fetchPricingBatch(endpointIds: string[], falKey: string) {
  const fal = createFalClient(falKey)

  async function fetchPrices(ids: string[]) {
    return await fal("/models/pricing", {
      method: "GET",
      params: { endpoint_id: ids },
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

  const pricingSyncedAt = new Date()

  try {
    // Try batch fetch first
    const data = await fetchPrices(endpointIds)

    const batch = data.prices.map(({ endpoint_id, ...pricing }) => {
      return db
        .update(models)
        .set({
          unitPrice: pricing.unit_price,
          unit: pricing.unit,
          currency: pricing.currency,
          pricingSyncedAt,
          syncError: null,
        })
        .where(eq(models.endpointId, endpoint_id))
    })

    if (R.hasAtLeast(batch, 1)) {
      await db.batch(batch)
    }

    return { updated: endpointIds.length, errors: 0 }
  } catch {
    // Batch failed (likely 404 for one model), try individually
    let errors = 0
    for (const endpointId of endpointIds) {
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
            pricingSyncedAt,
            syncError: null,
          })
          .where(eq(models.endpointId, endpointId))
      } catch (error) {
        errors++
        if (isResponseError(error)) {
          // fal has no pricing for this model
          if (error.status === 404) {
            await db
              .update(models)
              .set({
                unitPrice: null,
                unit: null,
                currency: null,
                pricingSyncedAt,
                syncError: error.message,
              })
              .where(eq(models.endpointId, endpointId))
            continue
          }
        }

        // unknown error, leave existing pricing in place, record error
        await db
          .update(models)
          .set({
            pricingSyncedAt,
            syncError: error instanceof Error ? error.message : String(error),
          })
          .where(eq(models.endpointId, endpointId))
      }
    }

    return { updated: endpointIds.length - errors, errors }
  }
}
