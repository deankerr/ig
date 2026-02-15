import { FileIcon, ImageOffIcon } from 'lucide-react'
import { type ComponentProps, useState } from 'react'

import { cn, serverUrl } from '@/lib/utils'

/** Snap requested width up to the nearest server transform breakpoint. */
const BREAKPOINTS = [256, 512, 1024, 2048] as const

function pickTransformWidth(width: number) {
  for (const bp of BREAKPOINTS) {
    if (width <= bp) return bp
  }
  return BREAKPOINTS[BREAKPOINTS.length - 1]!
}

function isImageContentType(contentType: string) {
  return contentType.startsWith('image/')
}

type ArtifactMediaProps = ComponentProps<'div'> & {
  /** Artifact ID, used to build the file URL. */
  id: string
  /** Content type of the artifact. Determines whether to render an image or a placeholder. */
  contentType: string
  /** Desired display width in pixels. The component picks the best server transform. */
  width: number
  /** How the image fills its container. */
  fit?: 'cover' | 'contain'
}

export function ArtifactMedia({
  id,
  contentType,
  width,
  fit = 'cover',
  className,
  ...props
}: ArtifactMediaProps) {
  const [error, setError] = useState(false)

  const isImage = isImageContentType(contentType)
  const transformWidth = pickTransformWidth(width)
  const src = `${serverUrl.origin}/artifacts/${id}/file?w=${transformWidth}&f=webp`

  return (
    <div className={cn('bg-muted text-muted-foreground overflow-hidden', className)} {...props}>
      {!isImage ? (
        <div className="flex h-full w-full items-center justify-center">
          <FileIcon className="size-5" />
        </div>
      ) : error ? (
        <div className="flex h-full w-full items-center justify-center">
          <ImageOffIcon className="size-5" />
        </div>
      ) : (
        <img
          src={src}
          alt=""
          loading="lazy"
          onError={() => setError(true)}
          className={cn('h-full w-full', fit === 'cover' ? 'object-cover' : 'object-contain')}
        />
      )}
    </div>
  )
}
