import { useInfiniteQuery } from '@tanstack/react-query'
import { Link, useSearch } from '@tanstack/react-router'
import { AlertCircleIcon } from 'lucide-react'
import { memo, useMemo } from 'react'

import { PulsingDot } from '@/components/shared/pulsing-dot'
import { TimeAgo } from '@/components/shared/time-ago'
import { Empty, EmptyDescription } from '@/components/ui/empty'
import { Item, ItemContent, ItemDescription, ItemGroup, ItemTitle } from '@/components/ui/item'
import { Skeleton } from '@/components/ui/skeleton'
import { useInfiniteScroll } from '@/hooks/use-infinite-scroll'
import { formatDuration, formatPrice, formatPrompt } from '@/lib/format'
import { listGenerationsOptions } from '@/lib/queries'

import { ArtifactThumbnail } from './shared/artifact-thumbnail'

export const GenerationList = memo(function GenerationList() {
  const search = useSearch({ from: '/' })
  const query = useInfiniteQuery(listGenerationsOptions())

  const { sentinelRef } = useInfiniteScroll({
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    fetchNextPage: query.fetchNextPage,
  })

  const allGenerations = useMemo(
    () => query.data?.pages.flatMap((p) => p.items) ?? [],
    [query.data],
  )

  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="flex min-h-6 items-center justify-between">
        <span className="text-muted-foreground text-xs">
          {allGenerations.length} generations{query.hasNextPage ? '+' : ''}
        </span>
      </div>

      {/* Loading state */}
      {query.isPending &&
        Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-36 w-full" />)}

      {/* Generation rows */}
      <ItemGroup>
        {allGenerations.map((gen) => (
          <GenerationRow key={gen.id} gen={gen} search={search} />
        ))}
      </ItemGroup>

      {/* Empty state */}
      {!query.isPending && allGenerations.length === 0 && (
        <Empty>
          <EmptyDescription>
            No generations yet. Use the craft bench to create some.
          </EmptyDescription>
        </Empty>
      )}

      {/* Infinite scroll sentinel */}
      <div ref={sentinelRef} className="h-px" />
    </div>
  )
})

// -- Generation row with derived status --

// Client-side staleness threshold — slightly longer than server's 5min REQUEST_TIMEOUT_MS.
const STALE_AFTER_MS = 6 * 60 * 1000

type Generation = {
  id: string
  model: string
  input: Record<string, unknown>
  batch: number
  error: string | null
  createdAt: Date
  completedAt: Date | null
  artifacts: Array<{ id: string; cost: number | null }>
}

type SearchParams = {
  view: 'artifacts' | 'generations'
  artifact?: string
  generation?: string
}

const GenerationRow = memo(function GenerationRow({
  gen,
  search,
}: {
  gen: Generation
  search: SearchParams
}) {
  const isInProgress = !gen.completedAt
  const isStale = isInProgress && Date.now() - new Date(gen.createdAt).getTime() > STALE_AFTER_MS
  const hasError = !!gen.error

  return (
    <Item variant="outline" render={<Link to="/" search={{ ...search, generation: gen.id }} />}>
      <ItemContent>
        <ItemTitle className="w-full">
          {/* Status indicator */}
          {isStale && <PulsingDot color="failed" pulse={false} />}
          {isInProgress && !isStale && <PulsingDot color="pending" />}
          {hasError && <AlertCircleIcon className="text-destructive size-4" />}

          {gen.model}

          <span className="text-muted-foreground">
            {gen.artifacts.length}/{gen.batch}
          </span>

          <div className="text-muted-foreground flex grow justify-end gap-4">
            <span>{formatPrice(gen.artifacts.reduce((sum, a) => sum + (a.cost ?? 0), 0))}</span>
            {gen.completedAt ? (
              <span>
                {formatDuration(
                  new Date(gen.completedAt).getTime() - new Date(gen.createdAt).getTime(),
                )}
              </span>
            ) : (
              <span className="text-muted-foreground/50">...</span>
            )}
            <span>
              <TimeAgo date={gen.createdAt} />
            </span>
          </div>
        </ItemTitle>

        <ItemDescription>{formatPrompt(gen.input)}</ItemDescription>
      </ItemContent>

      {/* Artifact thumbnails */}
      <div className="flex w-full flex-wrap gap-1 py-1">
        {gen.artifacts.map((a) => (
          <ArtifactThumbnail key={a.id} id={a.id} size="small" className="size-20" />
        ))}
        {/* Placeholder slots for expected-but-not-yet-arrived artifacts */}
        {isInProgress &&
          !isStale &&
          gen.artifacts.length < gen.batch &&
          Array.from({ length: gen.batch - gen.artifacts.length }).map((_, i) => (
            <div key={`placeholder-${i}`} className="bg-muted/50 size-20 animate-pulse rounded" />
          ))}
      </div>
    </Item>
  )
})
