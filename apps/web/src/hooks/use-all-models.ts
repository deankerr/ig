import { useEffect, useMemo } from "react"
import { useInfiniteQuery } from "@tanstack/react-query"

import { allModelsInfiniteOptions } from "@/queries/models"
import { orpc } from "@/utils/orpc"

export type Model = Awaited<ReturnType<typeof orpc.models.list.call>>["items"][number]

export function useAllModels() {
  const query = useInfiniteQuery(allModelsInfiniteOptions())

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
    return query.data.pages.flatMap((page) => page.items ?? [])
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
