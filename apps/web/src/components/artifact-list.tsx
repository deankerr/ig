import { useInfiniteQuery } from '@tanstack/react-query'
import { Link, useSearch } from '@tanstack/react-router'
import { memo, useMemo, useState } from 'react'

import { DisplayToggle } from '@/components/display-toggle'
import { ArtifactLink } from '@/components/shared/artifact-link'
import { ArtifactThumbnail } from '@/components/shared/artifact-thumbnail'
import { TimeAgo } from '@/components/shared/time-ago'
import { Empty, EmptyDescription } from '@/components/ui/empty'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from '@/components/ui/item'
import { Skeleton } from '@/components/ui/skeleton'
import { useInfiniteScroll } from '@/hooks/use-infinite-scroll'
import { formatDuration } from '@/lib/format'
import * as storage from '@/lib/storage'
import type { DisplayMode } from '@/lib/storage'
import { listArtifactsOptions } from '@/queries/artifacts'

const GRID_CLASSES = 'grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-1'

export const ArtifactList = memo(function ArtifactList() {
  const search = useSearch({ from: '/' })
  const [display, setDisplay] = useState<DisplayMode>(storage.getDisplayMode)

  const query = useInfiniteQuery(listArtifactsOptions())

  const { sentinelRef } = useInfiniteScroll({
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    fetchNextPage: query.fetchNextPage,
  })

  const allArtifacts = useMemo(() => query.data?.pages.flatMap((p) => p.items) ?? [], [query.data])

  function handleDisplayChange(mode: DisplayMode) {
    setDisplay(mode)
    storage.setDisplayMode(mode)
  }

  return (
    <div className="flex flex-col gap-3 p-3">
      {/* Controls */}
      <div className="flex min-h-6 items-center justify-between">
        <span className="text-muted-foreground text-xs">
          {allArtifacts.length} artifacts{query.hasNextPage ? '+' : ''}
        </span>
        <DisplayToggle value={display} onChange={handleDisplayChange} />
      </div>

      {/* Grid mode */}
      {display === 'grid' && (
        <div className={GRID_CLASSES}>
          {query.isPending
            ? Array.from({ length: 12 }).map((_, i) => (
                <Skeleton key={i} className="aspect-square" />
              ))
            : allArtifacts.map((artifact) => (
                <ArtifactLink key={artifact.id} id={artifact.id} mode="grid" />
              ))}
        </div>
      )}

      {/* List mode */}
      {display === 'list' && (
        <div className="flex flex-col gap-px">
          {query.isPending
            ? Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)
            : allArtifacts.map((artifact) => (
                <Item
                  key={artifact.id}
                  size="xs"
                  render={<Link to="/" search={{ ...search, artifact: artifact.id }} />}
                >
                  <ItemMedia variant="image">
                    <ArtifactThumbnail id={artifact.id} size="small" className="size-12" />
                  </ItemMedia>
                  <ItemContent>
                    <ItemTitle>{artifact.model}</ItemTitle>
                    <ItemDescription className="font-mono">
                      {artifact.id}
                      {artifact.seed != null && <span className="ml-2">seed:{artifact.seed}</span>}
                    </ItemDescription>
                  </ItemContent>
                  <ItemActions>
                    <span className="text-muted-foreground shrink-0 text-xs">
                      {artifact.duration != null && formatDuration(artifact.duration)}
                    </span>
                    <TimeAgo
                      date={artifact.createdAt}
                      className="text-muted-foreground shrink-0 text-xs"
                    />
                  </ItemActions>
                </Item>
              ))}
        </div>
      )}

      {/* Empty state */}
      {!query.isPending && allArtifacts.length === 0 && (
        <Empty>
          <EmptyDescription>No artifacts yet. Use the craft bench to create some.</EmptyDescription>
        </Empty>
      )}

      {/* Infinite scroll sentinel */}
      <div ref={sentinelRef} className="h-px" />
    </div>
  )
})
