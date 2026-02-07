import { env } from "@ig/env/web"
import { orpc } from "@/utils/orpc"

const PAGE_SIZE = 100

export function syncStatusQueryOptions() {
  return orpc.models.getSyncStatus.queryOptions({
    refetchInterval: (query) => {
      const data = query.state.data
      const activeStatuses = ["running", "queued", "waiting"]
      if (
        activeStatuses.includes(data?.standard ?? "") ||
        activeStatuses.includes(data?.all ?? "")
      ) {
        return 2000
      }
      return 30000
    },
  })
}

export function startSyncOptions() {
  return orpc.models.startSync.mutationOptions()
}

export function allModelsInfiniteOptions() {
  return orpc.models.list.infiniteOptions({
    input: (pageParam: number) => ({
      offset: pageParam,
      limit: PAGE_SIZE,
    }),
    getNextPageParam: (lastPage, _allPages, lastPageParam) =>
      lastPage.hasMore ? lastPageParam + PAGE_SIZE : undefined,
    initialPageParam: 0,
    queryKey: ["models", "all", env.VITE_BUILD_ID] as const,
  })
}
