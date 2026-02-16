// Runware model search client + KV cache (permanent storage).
// Merges the old models.ts and services/model-cache.ts into one service.

import { betterFetch } from '@better-fetch/fetch'
import { z } from 'zod'

import type { Context } from '../context'

const KV_PREFIX = 'model/'

// -- Schemas --

export const runwareModelSchema = z.object({
  air: z.string(),
  name: z.string(),
  version: z.string(),
  category: z.string(),
  architecture: z.string(),
  tags: z.array(z.string()),
  heroImage: z.string().nullable(),
  comment: z.string(),
  type: z.string().optional(),
  nsfwLevel: z.number(),
  defaultWidth: z.number().optional(),
  defaultHeight: z.number().optional(),
  defaultSteps: z.number().optional(),
  defaultScheduler: z.string().optional(),
  defaultCFG: z.number().optional(),
  defaultStrength: z.number().optional(),
  positiveTriggerWords: z.string().optional(),
  negativeTriggerWords: z.string().optional(),
  conditioning: z.string().optional(),
})

const runwareErrorSchema = z.looseObject({ code: z.string(), message: z.string() })

export const runwareResponseSchema = z.union([
  z.object({
    data: z.tuple([
      z.object({
        taskType: z.literal('modelSearch'),
        results: z.array(runwareModelSchema),
        totalResults: z.number(),
      }),
    ]),
  }),
  z.object({ errors: z.array(runwareErrorSchema) }),
])

export type RunwareModel = z.infer<typeof runwareModelSchema>

export type ModelSearchParams = {
  search?: string
  tags?: string[]
  category?: string
  type?: string
  architecture?: string
  conditioning?: string
  limit?: number
  offset?: number
}

export async function searchModels(ctx: Context, args: ModelSearchParams) {
  const taskUUID = crypto.randomUUID()

  const response = await betterFetch('https://api.runware.ai/v1', {
    method: 'POST',
    output: runwareResponseSchema,
    body: [
      { taskType: 'authentication', apiKey: ctx.env.RUNWARE_KEY },
      { taskType: 'modelSearch', taskUUID, ...args },
    ],
    throw: true,
  })

  if ('errors' in response) {
    throw new Error(`Runware API error: ${JSON.stringify(response.errors)}`)
  }

  const [modelSearch] = response.data

  console.log('[models:search]', {
    search: args.search,
    results: modelSearch.results.length,
    totalResults: modelSearch.totalResults,
  })

  // Cache each result in KV (fire-and-forget, permanent)
  for (const model of modelSearch.results) {
    ctx.waitUntil(cacheModel(ctx.env.CACHE, model))
  }

  return { results: modelSearch.results, totalResults: modelSearch.totalResults }
}

/** Search for a single model by AIR. Checks KV cache first, falls back to API. */
export async function lookupModel(ctx: Context, air: string): Promise<RunwareModel | null> {
  // Check KV first
  const cached = await getModel(ctx.env.CACHE, air)
  if (cached) return cached

  // Cache miss — search the API
  const result = await searchModels(ctx, { search: air, limit: 1 })
  return result.results[0] ?? null
}

// -- KV cache (permanent storage) --

/** Read a single model from KV by AIR. Returns null on miss or invalid data. */
export async function getModel(kv: KVNamespace, air: string): Promise<RunwareModel | null> {
  const raw = await kv.get(`${KV_PREFIX}${air}`)
  if (!raw) return null

  try {
    const parsed = runwareModelSchema.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

/** Read multiple models from KV by AIR. Returns a map of AIR → Model (misses omitted). */
export async function getModels(
  kv: KVNamespace,
  airs: string[],
): Promise<Map<string, RunwareModel>> {
  const unique = [...new Set(airs)]
  if (unique.length === 0) return new Map()

  const entries = await Promise.all(
    unique.map(async (air) => [air, await getModel(kv, air)] as const),
  )

  const map = new Map<string, RunwareModel>()
  for (const [air, model] of entries) {
    if (model) map.set(air, model)
  }
  return map
}

/** Write a model to KV permanently (no TTL). */
export async function cacheModel(kv: KVNamespace, model: RunwareModel): Promise<void> {
  await kv.put(`${KV_PREFIX}${model.air}`, JSON.stringify(model))
}
