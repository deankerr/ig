import { useState } from "react"
import { useInfiniteQuery } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { z } from "zod"
import { GenerationCard } from "@/components/generations/generation-card"
import { GenerationDetailModal } from "@/components/generations/generation-detail-modal"
import { GenerationFilters } from "@/components/generations/generation-filters"
import { GenerationListItem } from "@/components/generations/generation-list-item"
import { PageContent } from "@/components/layout"
import { ThumbnailGrid } from "@/components/thumbnail"
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll"
import { generationsInfiniteOptions } from "@/queries/generations"

const searchSchema = z.object({
  status: z.enum(["all", "pending", "ready", "failed"]).optional(),
  model: z.string().optional(),
  tags: z.array(z.string()).optional(),
  selected: z.string().optional(),
})

export const Route = createFileRoute("/generations/")({
  component: GenerationsPage,
  validateSearch: searchSchema,
})

function GenerationsPage() {
  const search = Route.useSearch()
  const statusFilter = search.status ?? "all"
  const modelFilter = search.model
  const tagFilters = search.tags ?? []
  const selectedId = search.selected
  const navigate = useNavigate()

  const setStatusFilter = (status: "all" | "pending" | "ready" | "failed") => {
    navigate({
      from: Route.fullPath,
      search: (prev) => ({ ...prev, status: status === "all" ? undefined : status }),
    })
  }

  const setModelFilter = (model: string | undefined) => {
    navigate({
      from: Route.fullPath,
      search: (prev) => ({ ...prev, model: model || undefined }),
    })
  }

  const setTagFilters = (tags: string[]) => {
    navigate({
      from: Route.fullPath,
      search: (prev) => ({ ...prev, tags: tags.length > 0 ? tags : undefined }),
    })
  }

  const setSelectedId = (id: string | undefined) => {
    navigate({
      from: Route.fullPath,
      search: (prev) => ({ ...prev, selected: id || undefined }),
    })
  }

  const [viewMode, setViewMode] = useState<"grid" | "list">(() => {
    if (typeof window === "undefined") return "grid"
    return (localStorage.getItem("generations-view-mode") as "grid" | "list") || "grid"
  })

  const generationsQuery = useInfiniteQuery(
    generationsInfiniteOptions({
      status: statusFilter,
      model: modelFilter,
      tags: tagFilters,
    }),
  )

  const allGenerations = generationsQuery.data?.pages.flatMap((page) => page.items ?? []) ?? []
  const selectedIndex = selectedId ? allGenerations.findIndex((g) => g.id === selectedId) : -1

  const { sentinelRef } = useInfiniteScroll({
    hasNextPage: !!generationsQuery.hasNextPage,
    isFetchingNextPage: generationsQuery.isFetchingNextPage,
    fetchNextPage: generationsQuery.fetchNextPage,
  })

  return (
    <div className="flex flex-col h-full">
      <GenerationFilters
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        modelFilter={modelFilter}
        onModelFilterChange={setModelFilter}
        tagFilters={tagFilters}
        onTagFiltersChange={setTagFilters}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        totalLoaded={allGenerations.length}
      />

      <PageContent>
        {allGenerations.length === 0 && !generationsQuery.isLoading && (
          <div className="text-center py-12 text-muted-foreground text-sm">
            no generations found
          </div>
        )}

        {viewMode === "grid" ? (
          <ThumbnailGrid>
            {allGenerations.map((generation) => (
              <GenerationCard
                key={generation.id}
                generation={generation}
                onSelect={setSelectedId}
              />
            ))}
          </ThumbnailGrid>
        ) : (
          <div className="flex flex-col gap-2 max-w-4xl mx-auto">
            {allGenerations.map((generation) => (
              <GenerationListItem
                key={generation.id}
                generation={generation}
                onSelect={setSelectedId}
              />
            ))}
          </div>
        )}

        <div ref={sentinelRef} className="h-px" />
        {generationsQuery.isFetchingNextPage && (
          <div className="py-4 text-center text-xs text-muted-foreground">loading...</div>
        )}
      </PageContent>

      <GenerationDetailModal
        generationId={selectedId ?? null}
        onClose={() => setSelectedId(undefined)}
        onPrev={() => {
          if (selectedIndex > 0) {
            setSelectedId(allGenerations[selectedIndex - 1]?.id)
          }
        }}
        onNext={() => {
          if (selectedIndex < allGenerations.length - 1) {
            setSelectedId(allGenerations[selectedIndex + 1]?.id)
          } else if (generationsQuery.hasNextPage && !generationsQuery.isFetchingNextPage) {
            generationsQuery.fetchNextPage()
          }
        }}
        hasPrev={selectedIndex > 0}
        hasNext={selectedIndex < allGenerations.length - 1 || !!generationsQuery.hasNextPage}
      />
    </div>
  )
}
