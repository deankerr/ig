/**
 * Runware model search client
 *
 * Portable — one file, no SDK dependency, just fetch + types.
 * Types match the Runware API response shape exactly.
 *
 * @see https://runware.ai/docs/utilities/model-search
 */

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

/**
 * Search Runware's model catalog.
 *
 * Sends auth + modelSearch tasks in a single request.
 * Returns results and totalResults — no transformation.
 */
export async function searchModels(
  apiKey: string,
  params: ModelSearchParams,
): Promise<ModelSearchResult> {
  const taskUUID = crypto.randomUUID()

  const response = await fetch(RUNWARE_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify([
      { taskType: 'authentication', apiKey },
      { taskType: 'modelSearch', taskUUID, ...params },
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

/**
 * Look up a single model by AIR ID.
 *
 * Searches by full AIR — works for all sources.
 * Returns null if the exact version isn't indexed on Runware.
 */
export async function lookupModel(apiKey: string, air: string): Promise<Model | null> {
  const result = await searchModels(apiKey, { search: air, limit: 1 })
  return result.results[0] ?? null
}
