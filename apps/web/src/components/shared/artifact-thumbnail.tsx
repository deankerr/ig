import { ImageOffIcon } from 'lucide-react'
import { useState } from 'react'

import { cn } from '@/lib/utils'
import { serverUrl } from '@/lib/utils'

const SIZE_MAP = {
  small: 256,
  medium: 512,
  large: 1024,
} as const

type ArtifactThumbnailProps = {
  id: string
  size?: keyof typeof SIZE_MAP
  className?: string
}

export function ArtifactThumbnail({ id, size = 'medium', className }: ArtifactThumbnailProps) {
  const [error, setError] = useState(false)
  const px = SIZE_MAP[size]
  const src = `${serverUrl.origin}/artifacts/${id}/file?w=${px}&f=webp`

  if (error) {
    return (
      <div
        className={cn('bg-muted text-muted-foreground flex items-center justify-center', className)}
      >
        <ImageOffIcon className="size-5" />
      </div>
    )
  }

  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      onError={() => setError(true)}
      className={cn('object-cover', className)}
    />
  )
}
