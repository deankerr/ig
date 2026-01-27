import { useState, type ReactNode } from "react"
import { Film, FileAudio, FileQuestion, Image as ImageIcon } from "lucide-react"

import { env } from "@ig/env/web"
import { cn } from "@/lib/utils"

/**
 * Cloudflare Image Resizing endpoint.
 * Format: https://orb.town/cdn-cgi/image/<OPTIONS>/<SOURCE-IMAGE>
 */
const CDN_IMAGE_PREFIX = "https://orb.town/cdn-cgi/image"

/**
 * Max thumbnail dimension in pixels.
 * - CDN resizes images to this width
 * - Grid cells are capped at this size
 * - Larger images waste bandwidth without visual benefit
 */
export const THUMBNAIL_SIZE = 400

/**
 * Responsive grid for thumbnail cards.
 * Auto-fills columns with min 200px, capped at THUMBNAIL_SIZE.
 */
export function ThumbnailGrid({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn("grid gap-3 justify-center", className)}
      style={{
        gridTemplateColumns: `repeat(auto-fill, minmax(200px, ${THUMBNAIL_SIZE}px))`,
      }}
    >
      {children}
    </div>
  )
}

/**
 * Renders a thumbnail for a generation.
 * Uses Cloudflare Image Resizing for optimized delivery.
 */
export function Thumbnail({
  generationId,
  contentType,
  status,
  className,
  size = THUMBNAIL_SIZE,
}: {
  generationId: string
  contentType: string | null
  status: "pending" | "ready" | "failed"
  className?: string
  size?: number
}) {
  const [error, setError] = useState(false)

  const isImage = contentType?.startsWith("image/")
  const isVideo = contentType?.startsWith("video/")
  const isAudio = contentType?.startsWith("audio/")

  // For ready images, use Cloudflare Image Resizing
  if (status === "ready" && isImage && !error) {
    const sourceUrl = `${env.VITE_SERVER_URL}/generations/${generationId}/file`
    const src = `${CDN_IMAGE_PREFIX}/w=${size},f=auto,q=80/${sourceUrl}`

    return (
      <img
        src={src}
        alt=""
        onError={() => setError(true)}
        className={cn("object-cover", className)}
      />
    )
  }

  // Pending state with animated scanlines
  if (status === "pending") {
    return (
      <div className={cn("flex items-center justify-center bg-muted scanlines-pending", className)}>
        <span className="text-xs text-status-pending animate-pulse">...</span>
      </div>
    )
  }

  // Failed state with red scanlines
  if (status === "failed") {
    return (
      <div className={cn("flex items-center justify-center bg-muted scanlines-failed", className)}>
        <span className="text-xs text-status-failed">err</span>
      </div>
    )
  }

  // Ready non-image fallback (video, audio, unknown)
  const Icon = isVideo ? Film : isAudio ? FileAudio : isImage ? ImageIcon : FileQuestion
  const label = isVideo ? "video" : isAudio ? "audio" : (contentType?.split("/")[1] ?? "file")

  return (
    <div className={cn("flex flex-col items-center justify-center gap-1 bg-muted", className)}>
      <Icon className="h-5 w-5 text-muted-foreground" />
      <span className="text-[10px] text-muted-foreground">{label}</span>
    </div>
  )
}
