import { Link, useSearch } from '@tanstack/react-router'

import { ArtifactThumbnail } from '@/components/shared/artifact-thumbnail'
import { cn } from '@/lib/utils'

type ArtifactLinkProps = {
  id: string
  /** "strip" = fixed-size thumbnail in a row. "grid" = fills parent aspect-square cell. */
  mode?: 'strip' | 'grid'
  /** Highlight border when this is the actively viewed artifact. */
  active?: boolean
  className?: string
}

export function ArtifactLink({ id, mode = 'strip', active, className }: ArtifactLinkProps) {
  const search = useSearch({ from: '/' })

  if (mode === 'grid') {
    return (
      <Link
        to="/"
        search={{ ...search, artifact: id }}
        className={cn(
          'hover:border-ring relative aspect-square overflow-hidden border border-transparent transition-colors',
          className,
        )}
      >
        <ArtifactThumbnail id={id} size="medium" className="h-full w-full" />
      </Link>
    )
  }

  return (
    <Link
      to="/"
      search={{ ...search, artifact: id }}
      className={cn(
        'border transition-colors',
        active ? 'border-ring' : 'hover:border-ring/50 border-transparent',
        className,
      )}
    >
      <ArtifactThumbnail id={id} size="small" className="size-20" />
    </Link>
  )
}
