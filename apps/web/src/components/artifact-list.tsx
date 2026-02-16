import { Link, useSearch } from '@tanstack/react-router'
import { memo, useMemo, useState } from 'react'

import { DisplayToggle } from '@/components/display-toggle'
import { ArtifactMedia } from '@/components/shared/artifact-media'
import { TimeAgo } from '@/components/shared/time-ago'
import { Empty, EmptyDescription } from '@/components/ui/empty'
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from '@/components/ui/item'
import { Skeleton } from '@/components/ui/skeleton'
import { useInfiniteScroll } from '@/hooks/use-infinite-scroll'
import { formatDuration, formatPrice, formatPrompt } from '@/lib/format'
import { useGenerations } from '@/lib/queries'
import * as storage from '@/lib/storage'
import type { DisplayMode } from '@/lib/storage'

import { ModelLabel } from './shared/model-label'

export const ArtifactList = memo(function ArtifactList() {
  const search = useSearch({ from: '/' })
  const [display, setDisplay] = useState<DisplayMode>(storage.getDisplayMode)

  const query = useGenerations()

  const { sentinelRef } = useInfiniteScroll({
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    fetchNextPage: query.fetchNextPage,
  })

  // Flatten artifacts from all generations, preserving parent generation context
  const allArtifacts = useMemo(
    () =>
      (query.data?.pages.flatMap((p) => p.items) ?? []).flatMap((gen) =>
        gen.artifacts.map((a) => ({ ...a, generation: gen })),
      ),
    [query.data],
  )

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
        <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-1">
          {query.isPending
            ? Array.from({ length: 12 }).map((_, i) => (
                <Skeleton key={i} className="aspect-square" />
              ))
            : allArtifacts.map((artifact) => (
                <Link
                  key={artifact.id}
                  to="/"
                  search={{ ...search, artifact: artifact.id }}
                  className="hover:border-ring relative aspect-square overflow-hidden border border-transparent transition-colors"
                >
                  <ArtifactMedia
                    id={artifact.id}
                    contentType={artifact.contentType}
                    width={512}
                    className="h-full w-full"
                  />
                </Link>
              ))}
        </div>
      )}

      {/* List mode */}
      {display === 'list' && (
        <ItemGroup>
          {query.isPending
            ? Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)
            : allArtifacts.map((artifact) => (
                <Item
                  key={artifact.id}
                  render={<Link to="/" search={{ ...search, artifact: artifact.id }} />}
                >
                  <ItemMedia variant="image">
                    <ArtifactMedia
                      id={artifact.id}
                      contentType={artifact.contentType}
                      width={256}
                    />
                  </ItemMedia>
                  <ItemContent className="overflow-hidden">
                    <ItemTitle className="w-full">
                      <ModelLabel air={artifact.model} />
                      <div className="text-muted-foreground ml-auto flex shrink-0 gap-4">
                        <span>{formatPrice(artifact.cost)}</span>
                        <span>
                          {artifact.generation.completedAt &&
                            formatDuration(
                              new Date(artifact.generation.completedAt).getTime() -
                                new Date(artifact.generation.createdAt).getTime(),
                            )}
                        </span>
                        <span>
                          <TimeAgo date={artifact.createdAt} />
                        </span>
                      </div>
                    </ItemTitle>
                    <ItemDescription>{formatPrompt(artifact.generation.input)}</ItemDescription>
                  </ItemContent>
                </Item>
              ))}
        </ItemGroup>
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
