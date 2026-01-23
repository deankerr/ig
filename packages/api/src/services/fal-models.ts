import { db } from "@ig/db"
import { models } from "@ig/db/schema"
import { up } from "up-fetch"
import z from "zod"

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
  // Optional fields
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
  prices: z.array(FalPricingItemSchema),
  next_cursor: z.string().nullable(),
  has_more: z.boolean(),
})

type FalModel = z.infer<typeof FalModelSchema>
type FalPricingItem = z.infer<typeof FalPricingItemSchema>

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

const DEV__BREAK_EARLY = false

type FalClient = ReturnType<typeof createFalClient>

export async function fetchAllModels(fal: FalClient) {
  const models: FalModel[] = []
  let cursor = ""
  const limit = 100

  while (true) {
    const data = await fal("/models", {
      method: "GET",
      params: { limit, cursor },
      schema: FalModelsResponseSchema,
    })

    models.push(...data.models)

    console.log("fal_models_page_fetched", {
      cursor,
      count: data.models.length,
      has_more: data.has_more,
      total_so_far: models.length,
    })

    if (!data.next_cursor) {
      break
    }

    if (DEV__BREAK_EARLY) break
    cursor = data.next_cursor
  }

  console.log("fal_models_fetch_complete", { total: models.length })
  return models
}

export async function fetchPricing(fal: FalClient, endpointIds: string[]) {
  const pricingMap = new Map<string, FalPricingItem>()
  const batchSize = 50

  for (let i = 0; i < endpointIds.length; i += batchSize) {
    const batch = endpointIds.slice(i, i + batchSize)

    try {
      const data = await fal("/models/pricing", {
        method: "GET",
        params: { endpoint_id: batch },
        schema: FalPricingResponseSchema,
      })

      for (const pricing of data.prices) {
        pricingMap.set(pricing.endpoint_id, pricing)
      }

      console.log("fal_pricing_batch_fetched", {
        batch: Math.floor(i / batchSize) + 1,
        count: data.prices.length,
      })
    } catch (error) {
      console.log("fal_pricing_batch_failed", {
        batch: Math.floor(i / batchSize) + 1,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  console.log("fal_pricing_fetch_complete", { total: pricingMap.size })
  return pricingMap
}

export async function syncModels(falKey: string) {
  const fal = createFalClient(falKey)

  // Fetch all models
  const falModels = await fetchAllModels(fal)
  const endpointIds = falModels.map((m) => m.endpoint_id)

  // Fetch pricing for all models
  const pricingMap = await fetchPricing(fal, endpointIds)

  // Prepare records - extract from nested metadata
  const now = new Date()
  const records = falModels
    .filter((m) => m.metadata) // Only models with metadata
    .map((m) => {
      const meta = m.metadata!
      const pricing = pricingMap.get(m.endpoint_id)
      return {
        endpointId: m.endpoint_id,
        displayName: meta.display_name,
        category: meta.category,
        description: meta.description,
        status: meta.status,
        tags: meta.tags,
        updatedAt: new Date(meta.updated_at),
        isFavorited: meta.is_favorited,
        thumbnailUrl: meta.thumbnail_url,
        modelUrl: meta.model_url,
        date: new Date(meta.date),
        thumbnailAnimatedUrl: meta.thumbnail_animated_url ?? null,
        githubUrl: meta.github_url ?? null,
        licenseType: meta.license_type ?? null,
        groupKey: meta.group?.key ?? null,
        groupLabel: meta.group?.label ?? null,
        kind: meta.kind ?? "unknown",
        durationEstimate: meta.duration_estimate ?? null,
        unitPrice: pricing?.unit_price ?? null,
        unit: pricing?.unit ?? null,
        currency: pricing?.currency ?? null,
        syncedAt: now,
      }
    })

  // Delete all existing records
  await db.delete(models)

  // batch inserting is unstable
  for (const record of records) {
    await db.insert(models).values(record)
  }

  const withPricing = records.filter((r) => r.unitPrice !== null).length
  console.log("fal_models_sync_complete", { total: records.length, withPricing })

  return { total: records.length, withPricing }
}
