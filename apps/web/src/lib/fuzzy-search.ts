import Fuse, { type IFuseOptions } from "fuse.js"

type Searchable = { endpointId: string; displayName: string }

const fuseOptions: IFuseOptions<Searchable> = {
  keys: ["endpointId", "displayName"],
  threshold: 0.4,
  ignoreLocation: true,
}

export function filterModels<T extends Searchable>(models: T[], query: string): T[] {
  const trimmed = query.trim()
  if (!trimmed) return models

  const fuse = new Fuse(models, fuseOptions)
  return fuse.search(trimmed).map((result) => result.item)
}

/**
 * Filter function for autocomplete that handles path separators intelligently.
 * Prioritizes exact prefix matches, especially when query contains '/'.
 */
export function filterModelForAutocomplete<T>(
  item: T,
  query: string,
  itemToString?: (item: T) => string,
): boolean {
  const q = query.toLowerCase()
  const v = (itemToString ? itemToString(item) : String(item)).toLowerCase()

  // Exact prefix match always wins
  if (v.startsWith(q)) return true

  // If query contains '/', require prefix match on path segments
  // This prevents "fal-ai/flux/" from matching "fal-ai/flux-2/..."
  if (q.includes("/")) {
    return v.startsWith(q)
  }

  // Otherwise allow fuzzy-ish matching (contains)
  return v.includes(q)
}
