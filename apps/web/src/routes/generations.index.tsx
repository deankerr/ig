import { useEffect, useRef, useState } from "react"
import { useInfiniteQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"

import { GenerationCard } from "@/components/generation-card"
import { PageHeader, PageContent } from "@/components/layout"
import { ThumbnailGrid } from "@/components/thumbnail"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { client } from "@/utils/orpc"

export const Route = createFileRoute("/generations/")({
  component: GenerationsPage,
})

type GenerationStatus = "pending" | "ready" | "failed"

function GenerationsPage() {
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const sentinelRef = useRef<HTMLDivElement>(null)

  const generationsQuery = useInfiniteQuery({
    queryKey: ["generations", "list", { status: statusFilter }],
    queryFn: async ({ pageParam }) => {
      return client.generations.list({
        status: statusFilter === "all" ? undefined : (statusFilter as GenerationStatus),
        limit: 24,
        cursor: pageParam,
      })
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    refetchInterval: statusFilter === "pending" || statusFilter === "all" ? 5000 : false,
  })

  const allGenerations = generationsQuery.data?.pages.flatMap((page) => page.items ?? []) ?? []

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (
          entry?.isIntersecting &&
          generationsQuery.hasNextPage &&
          !generationsQuery.isFetchingNextPage
        ) {
          generationsQuery.fetchNextPage()
        }
      },
      { rootMargin: "200px" },
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [
    generationsQuery.hasNextPage,
    generationsQuery.isFetchingNextPage,
    generationsQuery.fetchNextPage,
  ])

  return (
    <div className="flex flex-col h-full">
      <PageHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-sm font-medium">generations</h1>
            <span className="text-xs text-muted-foreground">{allGenerations.length} loaded</span>
          </div>
          <div className="flex items-center gap-2">
            <Select value={statusFilter} onValueChange={(v) => v && setStatusFilter(v)}>
              <SelectTrigger className="w-[120px] h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">all</SelectItem>
                <SelectItem value="pending">pending</SelectItem>
                <SelectItem value="ready">ready</SelectItem>
                <SelectItem value="failed">failed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </PageHeader>

      <PageContent>
        {allGenerations.length === 0 && !generationsQuery.isLoading && (
          <div className="text-center py-12 text-muted-foreground text-sm">
            no generations found
          </div>
        )}

        <ThumbnailGrid>
          {allGenerations.map((generation) => (
            <GenerationCard key={generation.id} generation={generation} />
          ))}
        </ThumbnailGrid>

        <div ref={sentinelRef} className="h-px" />
        {generationsQuery.isFetchingNextPage && (
          <div className="py-4 text-center text-xs text-muted-foreground">loading...</div>
        )}
      </PageContent>
    </div>
  )
}
