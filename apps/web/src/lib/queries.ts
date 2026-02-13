import { orpc } from '@/lib/api'

// -- Browse --

export function listArtifactsOptions() {
  return orpc.browse.listArtifacts.infiniteOptions({
    input: (cursor) => ({ cursor, limit: 20 }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    staleTime: 30_000,
  })
}

export function getArtifactOptions(id: string) {
  return orpc.browse.getArtifact.queryOptions({ input: { id } })
}

export function listGenerationsOptions() {
  return orpc.browse.listGenerations.infiniteOptions({
    input: (cursor) => ({ cursor, limit: 20 }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    staleTime: 30_000,
  })
}

export function getGenerationOptions(id: string) {
  return orpc.browse.getGeneration.queryOptions({ input: { id } })
}

// -- Inference --

export function createImageMutation() {
  return orpc.inference.createImage.mutationOptions()
}

export function statusQueryOptions(id: string) {
  return orpc.inference.getStatus.queryOptions({
    input: { id },
    refetchInterval: (query) => {
      const data = query.state.data
      if (data?.completedAt) return false
      return 1000
    },
  })
}

// -- Health --

export function healthQueryOptions() {
  return orpc.healthCheck.queryOptions({
    refetchInterval: 30000,
    retry: 1,
  })
}
