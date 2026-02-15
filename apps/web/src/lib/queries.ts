import { useInfiniteQuery, useMutation, useQuery } from '@tanstack/react-query'

import { orpc } from '@/lib/api'

// -- Artifacts --

export function useArtifact(id: string) {
  return useQuery(orpc.artifacts.get.queryOptions({ input: { id } }))
}

export function useArtifactsByTag(tag: string, value?: string) {
  return useQuery(orpc.artifacts.listByTag.queryOptions({ input: { tag, value } }))
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
    }),
  )
}

export function useGeneration(id: string) {
  return useQuery(orpc.generations.get.queryOptions({ input: { id } }))
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
