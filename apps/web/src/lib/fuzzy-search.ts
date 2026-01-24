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
