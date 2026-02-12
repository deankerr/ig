import { useInfiniteQuery } from '@tanstack/react-query'
import { Link, useSearch } from '@tanstack/react-router'
import { memo, useMemo } from 'react'

import { TimeAgo } from '@/components/shared/time-ago'
import { Empty, EmptyDescription } from '@/components/ui/empty'
import { Item, ItemContent, ItemDescription, ItemGroup, ItemTitle } from '@/components/ui/item'
import { Skeleton } from '@/components/ui/skeleton'
import { useInfiniteScroll } from '@/hooks/use-infinite-scroll'
import { formatDuration, formatPrice, formatPrompt } from '@/lib/format'
import { listGenerationsOptions } from '@/queries/generations'

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
          <Item
            key={gen.id}
            variant="outline"
            render={<Link to="/" search={{ ...search, generation: gen.id }} />}
          >
            {/* Generation record — links to generation detail */}
            <ItemContent>
              <ItemTitle className="w-full">
                {gen.model}

                <span className="text-muted-foreground">
                  {gen.artifacts.length}/{gen.artifactCount}
                </span>

                <div className="text-muted-foreground flex grow justify-end gap-4">
                  <span>
                    {formatPrice(gen.artifacts.reduce((sum, a) => sum + (a.cost ?? 0), 0))}
                  </span>
                  <span>
                    {formatDuration(
                      new Date(gen.completedAt).getTime() - new Date(gen.createdAt).getTime(),
                    )}
                  </span>
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
            </div>
          </Item>
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
