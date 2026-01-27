import { useEffect, useMemo, useRef, useState } from "react"
import { useInfiniteQuery, useQuery } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { z } from "zod"
import { LayoutGridIcon, ListIcon, XIcon } from "lucide-react"

import { GenerationCard } from "@/components/generation-card"
import { GenerationDetailModal } from "@/components/generations/generation-detail-modal"
import { PageHeader, PageContent } from "@/components/layout"
import { Tag } from "@/components/tag"
import { TimeAgo } from "@/components/time-ago"
import { Thumbnail, ThumbnailGrid } from "@/components/thumbnail"
import {
  Autocomplete,
  AutocompleteEmpty,
  AutocompleteInput,
  AutocompleteItem,
  AutocompleteList,
  AutocompletePopup,
} from "@/components/ui/autocomplete"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ButtonGroup } from "@/components/ui/button-group"
import { Item, ItemContent, ItemMedia, ItemTitle } from "@/components/ui/item"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { formatEndpointId } from "@/lib/format-endpoint"
import { client } from "@/utils/orpc"

const searchSchema = z.object({
  status: z.enum(["all", "pending", "ready", "failed"]).optional(),
  endpoint: z.string().optional(),
  tags: z.array(z.string()).optional(),
  selected: z.string().optional(),
})

export const Route = createFileRoute("/generations/")({
  component: GenerationsPage,
  validateSearch: searchSchema,
})

type GenerationStatus = "pending" | "ready" | "failed"

type Generation = {
  id: string
  slug: string | null
  endpoint: string
  status: GenerationStatus
  contentType: string | null
  input: Record<string, unknown>
  tags: string[]
  createdAt: Date
}

function GenerationListItem({
  generation,
  onSelect,
}: {
  generation: Generation
  onSelect?: (id: string) => void
}) {
  const prompt = generation.input?.prompt as string | undefined

  const itemProps = onSelect
    ? {
        onClick: () => onSelect(generation.id),
        onKeyDown: (e: React.KeyboardEvent) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            onSelect(generation.id)
          }
        },
        role: "button" as const,
        tabIndex: 0,
        className: "cursor-pointer",
      }
    : {}

  return (
    <Item variant="outline" {...itemProps}>
      <ItemMedia className="w-[180px]">
        <Thumbnail
          generationId={generation.id}
          contentType={generation.contentType}
          status={generation.status}
          size={180}
          className="w-full object-cover h-[180px]"
        />
      </ItemMedia>
      <ItemContent className="justify-between h-full">
        <div className="flex items-center gap-2">
          <ItemTitle>{formatEndpointId(generation.endpoint)}</ItemTitle>
          <span className="text-muted-foreground">·</span>
          <TimeAgo date={generation.createdAt} className=" text-muted-foreground" />
        </div>
        <span className="font-mono text-muted-foreground">{generation.slug ?? generation.id}</span>
        {prompt && (
          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{prompt}</p>
        )}
        {generation.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {generation.tags.slice(0, 3).map((tag) => (
              <Tag key={tag} className="">
                {tag}
              </Tag>
            ))}
            {generation.tags.length > 3 && (
              <span className="text-muted-foreground">+{generation.tags.length - 3}</span>
            )}
          </div>
        )}
      </ItemContent>
    </Item>
  )
}

function GenerationsPage() {
  const search = Route.useSearch()
  const statusFilter = search.status ?? "all"
  const endpointFilter = search.endpoint
  const tagFilters = search.tags ?? []
  const selectedId = search.selected
  const navigate = useNavigate()

  const setStatusFilter = (status: "all" | "pending" | "ready" | "failed") => {
    navigate({
      from: Route.fullPath,
      search: (prev) => ({ ...prev, status: status === "all" ? undefined : status }),
    })
  }

  const setEndpointFilter = (endpoint: string | undefined) => {
    navigate({
      from: Route.fullPath,
      search: (prev) => ({ ...prev, endpoint: endpoint || undefined }),
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

  const [endpointInput, setEndpointInput] = useState(endpointFilter ?? "")
  const [tagInput, setTagInput] = useState("")
  const [viewMode, setViewMode] = useState<"grid" | "list">(() => {
    if (typeof window === "undefined") return "grid"
    return (localStorage.getItem("generations-view-mode") as "grid" | "list") || "grid"
  })
  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    localStorage.setItem("generations-view-mode", viewMode)
  }, [viewMode])

  useEffect(() => {
    setEndpointInput(endpointFilter ?? "")
  }, [endpointFilter])

  const endpointsQuery = useQuery({
    queryKey: ["generations", "listEndpoints"],
    queryFn: () => client.generations.listEndpoints({}),
    staleTime: 60_000,
  })

  const filteredEndpoints = useMemo(() => {
    const all = endpointsQuery.data?.endpoints ?? []
    if (!endpointInput) return all
    const lower = endpointInput.toLowerCase()
    return all.filter((e) => e.toLowerCase().includes(lower))
  }, [endpointsQuery.data?.endpoints, endpointInput])

  const tagsQuery = useQuery({
    queryKey: ["generations", "listTags"],
    queryFn: () => client.generations.listTags({}),
    staleTime: 60_000,
  })

  const availableTags = useMemo(() => {
    const all = tagsQuery.data?.tags ?? []
    return all.filter((t) => !tagFilters.includes(t))
  }, [tagsQuery.data?.tags, tagFilters])

  const filteredTags = useMemo(() => {
    if (!tagInput) return availableTags
    const lower = tagInput.toLowerCase()
    return availableTags.filter((t) => t.toLowerCase().includes(lower))
  }, [availableTags, tagInput])

  const generationsQuery = useInfiniteQuery({
    queryKey: [
      "generations",
      "list",
      { status: statusFilter, endpoint: endpointFilter, tags: tagFilters },
    ],
    queryFn: async ({ pageParam }) => {
      return client.generations.list({
        status: statusFilter === "all" ? undefined : (statusFilter as GenerationStatus),
        endpoint: endpointFilter,
        tags: tagFilters.length > 0 ? tagFilters : undefined,
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
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <h1 className="text-sm font-medium">generations</h1>
            <span className="text-xs text-muted-foreground">{allGenerations.length} loaded</span>
            <ButtonGroup>
              <Button
                size="icon-sm"
                variant={viewMode === "grid" ? "default" : "ghost"}
                onClick={() => setViewMode("grid")}
                aria-label="Grid view"
              >
                <LayoutGridIcon />
              </Button>
              <Button
                size="icon-sm"
                variant={viewMode === "list" ? "default" : "ghost"}
                onClick={() => setViewMode("list")}
                aria-label="List view"
              >
                <ListIcon />
              </Button>
            </ButtonGroup>
          </div>
          <div className="flex items-center gap-2">
            <Autocomplete>
              <AutocompleteInput
                placeholder="endpoint"
                className="w-[220px] h-7"
                value={endpointInput}
                onChange={(e) => setEndpointInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && endpointInput.trim()) {
                    e.preventDefault()
                    setEndpointFilter(endpointInput.trim())
                  }
                }}
              />
              <AutocompletePopup>
                <AutocompleteList>
                  {filteredEndpoints.map((endpoint) => (
                    <AutocompleteItem
                      key={endpoint}
                      value={endpoint}
                      onClick={() => {
                        setEndpointFilter(endpoint)
                        setEndpointInput(endpoint)
                      }}
                    >
                      {formatEndpointId(endpoint)}
                    </AutocompleteItem>
                  ))}
                </AutocompleteList>
                <AutocompleteEmpty />
              </AutocompletePopup>
            </Autocomplete>

            <Autocomplete autoHighlight={false}>
              <AutocompleteInput
                placeholder="add tag"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && tagInput.trim()) {
                    e.preventDefault()
                    const tag = tagInput.trim()
                    if (!tagFilters.includes(tag)) {
                      setTagFilters([...tagFilters, tag])
                    }
                    setTagInput("")
                  }
                }}
                className="w-[220px] h-7"
              />
              <AutocompletePopup>
                <AutocompleteList>
                  {filteredTags.map((tag) => (
                    <AutocompleteItem
                      key={tag}
                      value={tag}
                      onClick={() => {
                        if (!tagFilters.includes(tag)) {
                          setTagFilters([...tagFilters, tag])
                        }
                        setTagInput("")
                      }}
                    >
                      {tag}
                    </AutocompleteItem>
                  ))}
                </AutocompleteList>
                <AutocompleteEmpty />
              </AutocompletePopup>
            </Autocomplete>

            {tagFilters.map((tag) => (
              <Badge
                key={tag}
                variant="secondary"
                className="h-7 gap-1 text-xs cursor-pointer"
                onClick={() => setTagFilters(tagFilters.filter((t) => t !== tag))}
              >
                {tag}
                <XIcon className="size-3" />
              </Badge>
            ))}

            <Select
              value={statusFilter}
              onValueChange={(v) =>
                v && setStatusFilter(v as "all" | "pending" | "ready" | "failed")
              }
            >
              <SelectTrigger className="w-[100px] h-7 text-xs">
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
          const currentIndex = allGenerations.findIndex((g) => g.id === selectedId)
          if (currentIndex > 0) {
            setSelectedId(allGenerations[currentIndex - 1]?.id)
          }
        }}
        onNext={() => {
          const currentIndex = allGenerations.findIndex((g) => g.id === selectedId)
          if (currentIndex < allGenerations.length - 1) {
            setSelectedId(allGenerations[currentIndex + 1]?.id)
          } else if (generationsQuery.hasNextPage && !generationsQuery.isFetchingNextPage) {
            generationsQuery.fetchNextPage()
          }
        }}
        hasPrev={(() => {
          const currentIndex = allGenerations.findIndex((g) => g.id === selectedId)
          return currentIndex > 0
        })()}
        hasNext={(() => {
          const currentIndex = allGenerations.findIndex((g) => g.id === selectedId)
          return currentIndex < allGenerations.length - 1 || generationsQuery.hasNextPage
        })()}
      />
    </div>
  )
}
