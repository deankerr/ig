import { useEffect, useMemo } from "react"
import { useInfiniteQuery } from "@tanstack/react-query"

import { env } from "@ig/env/web"
import { client } from "@/utils/orpc"

const PAGE_SIZE = 100

export type Model = Awaited<ReturnType<typeof client.models.list>>["items"][number]

export function useAllModels() {
  const query = useInfiniteQuery({
    queryKey: ["models", "all", env.VITE_BUILD_ID],
    queryFn: async ({ pageParam = 0 }) => {
      return client.models.list({ offset: pageParam, limit: PAGE_SIZE })
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, _allPages, lastPageParam) => {
      return lastPage.hasMore ? lastPageParam + PAGE_SIZE : undefined
    },
  })

  // Auto-fetch all pages when there are more to fetch
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage()
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  // Flatten all pages into a single array
  const models = useMemo(() => {
    if (!query.data) return []
    return query.data.pages.flatMap((page) => page.items)
  }, [query.data])

  // Loading state: true if initial fetch or still fetching pages
  const isLoading = query.isLoading || hasNextPage === true

  return {
    models,
    isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  }
}
