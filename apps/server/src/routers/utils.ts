// Shared router utilities — pagination, model enrichment.

import { z } from 'zod'

import { type RunwareModel, getModels } from '../services/models'

// -- Pagination --

export const paginationInput = z.object({
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(100).optional().default(20),
})

// Cursor: "{createdAt_ms}:{id}" — encodes position for keyset pagination
export function encodeCursor(createdAt: Date, id: string) {
  return `${createdAt.getTime()}:${id}`
}

export function decodeCursor(cursor: string) {
  const colonIndex = cursor.indexOf(':')
  if (colonIndex === -1) return null
  const ms = Number(cursor.slice(0, colonIndex))
  const id = cursor.slice(colonIndex + 1)
  if (Number.isNaN(ms) || !id) return null
  return { createdAt: new Date(ms), id }
}

// -- Model enrichment --

/** Batch-read model data from KV and attach to items that have a `model` AIR field. */
export async function enrichWithModels<T extends { model: string | null }>(
  kv: KVNamespace,
  items: T[],
): Promise<(T & { modelData: RunwareModel | null })[]> {
  const airs = items.flatMap((item) => (item.model ? [item.model] : []))
  const modelMap = await getModels(kv, airs)
  return items.map((item) => ({
    ...item,
    modelData: item.model ? (modelMap.get(item.model) ?? null) : null,
  }))
}
