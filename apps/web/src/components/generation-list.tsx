import { useInfiniteQuery } from '@tanstack/react-query'
import { Link, useSearch } from '@tanstack/react-router'
import { memo, useMemo } from 'react'

import { ArtifactLink } from '@/components/shared/artifact-link'
import { TimeAgo } from '@/components/shared/time-ago'
import { Empty, EmptyDescription } from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { useInfiniteScroll } from '@/hooks/use-infinite-scroll'
import { formatDuration } from '@/lib/format'
import { listGenerationsOptions } from '@/queries/generations'

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
        Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}

      {/* Generation rows */}
      <div className="flex flex-col gap-px">
        {allGenerations.map((gen) => (
          <div key={gen.id} className="border-border flex flex-col gap-2 border-b px-2 py-2">
            {/* Header + prompt — links to generation detail */}
            <Link
              to="/"
              search={{ ...search, generation: gen.id }}
              className="hover:bg-muted flex flex-col gap-2 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium">{gen.model}</span>
                <span className="text-muted-foreground text-xs">
                  {gen.artifactCount} artifact{gen.artifactCount !== 1 ? 's' : ''}
                  {' · '}
                  {formatDuration(
                    new Date(gen.completedAt).getTime() - new Date(gen.createdAt).getTime(),
                  )}
                </span>
                <div className="flex-1" />
                <TimeAgo date={gen.createdAt} className="text-muted-foreground text-xs" />
              </div>

              {/* Prompt snippet */}
              {gen.input && (
                <div className="text-muted-foreground truncate text-xs">
                  {typeof gen.input === 'object' && 'positivePrompt' in gen.input
                    ? String(gen.input.positivePrompt).slice(0, 120)
                    : JSON.stringify(gen.input).slice(0, 120)}
                </div>
              )}
            </Link>

            {/* Artifact thumbnails — separate links to individual artifacts */}
            {gen.artifacts.length > 0 && (
              <div className="flex gap-1">
                {gen.artifacts.map((a) => (
                  <ArtifactLink key={a.id} id={a.id} />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

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
