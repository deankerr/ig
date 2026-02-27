import type { RunwareModel } from '@ig/server'
import { useInfiniteQuery, useMutation, useQuery } from '@tanstack/react-query'

import { queryClient, orpc } from '@/lib/api'

// -- Model cache seeding --

/** Seed the React Query model cache from server-enriched responses.
 *  Called in `select` so the cache is warm before components render. */
function seedModelCache(items: { model: string | null; modelData: RunwareModel | null }[]) {
  for (const item of items) {
    if (!item.model || !item.modelData) continue
    const key = orpc.models.get.queryKey({ input: { air: item.model } })
    if (!queryClient.getQueryData(key)) {
      queryClient.setQueryData(key, item.modelData)
    }
  }
}

// -- Models --

export function useModel(air: string | undefined) {
  return useQuery({
    ...orpc.models.get.queryOptions({ input: { air: air! } }),
    enabled: !!air,
    staleTime: Infinity,
    retry: 1,
  })
}

export function useModelSearch(query: string) {
  return useQuery({
    ...orpc.models.search.queryOptions({ input: { search: query, limit: 50 } }),
    enabled: query.length >= 2,
    select: (data) => {
      // Seed model cache from search results
      seedModelCache(data.results.map((m) => ({ model: m.air, modelData: m })))
      return data
    },
  })
}

// -- Artifacts --

export function useArtifact(id: string) {
  return useQuery({
    ...orpc.artifacts.get.queryOptions({ input: { id } }),
    select: (data) => {
      if (data) {
        // Seed from artifact, generation (if present), and siblings
        seedModelCache([data.artifact, ...data.siblings])
        if (data.generation) seedModelCache([data.generation])
      }
      return data
    },
  })
}

export function useArtifacts() {
  return useInfiniteQuery(
    orpc.artifacts.list.infiniteOptions({
      input: (cursor) => ({ cursor, limit: 20 }),
      initialPageParam: undefined as string | undefined,
      getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
      staleTime: 5_000,
      refetchInterval: 10_000,
      select: (data) => {
        for (const page of data.pages) {
          seedModelCache(page.items)
        }
        return data
      },
    }),
  )
}

export function useArtifactsByTag(tag: string, value?: string) {
  return useQuery({
    ...orpc.artifacts.listByTag.queryOptions({ input: { tag, value } }),
    select: (data) => {
      seedModelCache(data.items)
      return data
    },
  })
}

export function useDeleteArtifact() {
  return useMutation(orpc.artifacts.delete.mutationOptions())
}

// -- Generations --

export function useGenerations() {
  return useInfiniteQuery(
    orpc.generations.list.infiniteOptions({
      input: (cursor) => ({ cursor, limit: 20 }),
      initialPageParam: undefined as string | undefined,
      getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
      staleTime: 5_000,
      refetchInterval: 10_000,
      select: (data) => {
        for (const page of data.pages) {
          seedModelCache(page.items)
        }
        return data
      },
    }),
  )
}

export function useGeneration(id: string) {
  return useQuery({
    ...orpc.generations.get.queryOptions({ input: { id } }),
    select: (data) => {
      if (data) seedModelCache([data])
      return data
    },
  })
}

export function useDeleteGeneration() {
  return useMutation(orpc.generations.delete.mutationOptions())
}

// -- Inference --

export function useCreateImage() {
  return useMutation(orpc.generations.create.mutationOptions())
}

export function statusQueryOptions(id: string) {
  return orpc.generations.status.queryOptions({ input: { id } })
}

// -- Health --

export function useHealth() {
  return useQuery(
    orpc.healthCheck.queryOptions({
      refetchInterval: 30000,
      retry: 1,
    }),
  )
}
