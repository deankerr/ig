import { orpc, queryClient } from "@/lib/orpc"

// --- Query option factories ---

export function generationQueryOptions(id: string | null) {
  return orpc.generations.get.queryOptions({
    input: { id: id ?? "" },
    enabled: !!id,
    refetchInterval: (query) => (query.state.data?.status === "pending" ? 2000 : false),
  })
}

export function pendingCountQueryOptions() {
  return orpc.generations.list.queryOptions({
    input: { status: "pending" as const, limit: 1 },
    refetchInterval: 5000,
  })
}

export function generationTagsQueryOptions() {
  return orpc.generations.listTags.queryOptions({
    staleTime: 60_000,
  })
}

type GenerationStatus = "pending" | "ready" | "failed"

export function generationsInfiniteOptions(filters: {
  status: string
  model?: string
  tags: string[]
}) {
  return orpc.generations.list.infiniteOptions({
    input: (pageParam: string | undefined) => ({
      status: filters.status === "all" ? undefined : (filters.status as GenerationStatus),
      model: filters.model,
      tags: filters.tags.length > 0 ? filters.tags : undefined,
      limit: 24,
      cursor: pageParam,
    }),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: undefined as string | undefined,
    refetchInterval: filters.status === "pending" || filters.status === "all" ? 5000 : false,
  })
}

// --- Mutation option factories ---

export function deleteGenerationOptions() {
  return orpc.generations.delete.mutationOptions()
}

export function regenerateGenerationOptions() {
  return orpc.generations.regenerate.mutationOptions()
}

export function updateGenerationOptions() {
  return orpc.generations.update.mutationOptions()
}

export function createGenerationOptions() {
  return orpc.generations.create.mutationOptions()
}

// --- Invalidation helpers ---

export function invalidateGenerations() {
  return queryClient.invalidateQueries({ queryKey: orpc.generations.key() })
}

export function invalidateGeneration(id: string) {
  return queryClient.invalidateQueries({
    queryKey: orpc.generations.get.queryKey({ input: { id } }),
  })
}
