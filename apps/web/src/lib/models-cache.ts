const CACHE_KEY = "ig-models-cache"
const CACHE_TTL = 60 * 60 * 1000 // 1 hour

export type ModelsCacheEntry<T> = {
  items: T[]
  fetchedAt: number
}

export function getModelsCache<T>(): ModelsCacheEntry<T> | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null

    const cache = JSON.parse(raw) as ModelsCacheEntry<T>
    if (Date.now() - cache.fetchedAt > CACHE_TTL) {
      localStorage.removeItem(CACHE_KEY)
      return null
    }
    return cache
  } catch {
    return null
  }
}

export function setModelsCache<T>(data: ModelsCacheEntry<T>): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data))
  } catch {
    // localStorage full or unavailable, ignore
  }
}

export function clearModelsCache(): void {
  localStorage.removeItem(CACHE_KEY)
}
