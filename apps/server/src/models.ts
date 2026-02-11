/**
 * Runware model search client
 *
 * Portable — one file, no SDK dependency, just fetch + types.
 * Types match the Runware API response shape exactly.
 *
 * @see https://runware.ai/docs/utilities/model-search
 */

import type { Context } from './context'

const RUNWARE_API_URL = 'https://api.runware.ai/v1'

// -- Types --

export type ModelSearchParams = {
  search?: string
  tags?: string[]
  category?: string
  type?: string
  architecture?: string
  conditioning?: string
  visibility?: string
  limit?: number
  offset?: number
}

export type Model = {
  air: string
  name: string
  version: string
  category: string
  architecture: string
  tags: string[]
  heroImage: string
  private: boolean
  comment: string
  type?: string
  defaultWidth?: number
  defaultHeight?: number
  defaultSteps?: number
  defaultScheduler?: string
  defaultCFG?: number
  defaultStrength?: number
  positiveTriggerWords?: string
  conditioning?: string
}

export type ModelSearchResult = {
  results: Model[]
  totalResults: number
}

// -- Client --

export async function searchModels(
  ctx: Context,
  args: ModelSearchParams,
): Promise<ModelSearchResult> {
  const taskUUID = crypto.randomUUID()

  const response = await fetch(RUNWARE_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify([
      { taskType: 'authentication', apiKey: ctx.env.RUNWARE_KEY },
      { taskType: 'modelSearch', taskUUID, ...args },
    ]),
  })

  if (!response.ok) {
    throw new Error(`Runware API error: ${response.status} ${await response.text()}`)
  }

  const body = (await response.json()) as {
    data?: Array<{ taskType: string; results?: Model[]; totalResults?: number }>
  }

  const searchResult = body.data?.find((d) => d.taskType === 'modelSearch')
  return {
    results: searchResult?.results ?? [],
    totalResults: searchResult?.totalResults ?? 0,
  }
}

export async function lookupModel(ctx: Context, args: { air: string }): Promise<Model | null> {
  const result = await searchModels(ctx, { search: args.air, limit: 1 })
  return result.results[0] ?? null
}
