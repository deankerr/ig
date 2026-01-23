import { useState } from "react"
import { Image } from "@unpic/react/base"
import { Film, FileAudio, FileQuestion, Image as ImageIcon } from "lucide-react"

import { env } from "@ig/env/web"
import { cn } from "@/lib/utils"

/**
 * Custom transformer for our image API.
 * Maps unpic's width/height params to our query string format.
 */
function igTransformer(src: string | URL, operations: { width?: number; height?: number }) {
  const base = src.toString().split("?")[0]
  const params = new URLSearchParams()
  if (operations.width) params.set("w", String(Math.round(operations.width)))
  if (operations.height) params.set("h", String(Math.round(operations.height)))
  const query = params.toString()
  return query ? `${base}?${query}` : base
}

/**
 * Renders a thumbnail for a generation.
 * Uses unpic for responsive images with our transform API.
 */
export function Thumbnail({
  generationId,
  contentType,
  status,
  className,
}: {
  generationId: string
  contentType: string | null
  status: "pending" | "ready" | "failed"
  className?: string
}) {
  const [error, setError] = useState(false)

  const isImage = contentType?.startsWith("image/")
  const isVideo = contentType?.startsWith("video/")
  const isAudio = contentType?.startsWith("audio/")

  // For ready images, use unpic
  if (status === "ready" && isImage && !error) {
    const src = `${env.VITE_SERVER_URL}/generations/${generationId}/file`

    return (
      <Image
        src={src}
        alt=""
        layout="fullWidth"
        transformer={igTransformer}
        onError={() => setError(true)}
        className={cn("object-cover", className)}
        background="auto"
      />
    )
  }

  // Pending state with animated scanlines
  if (status === "pending") {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-muted scanlines-pending",
          className,
        )}
      >
        <span className="text-xs text-status-pending animate-pulse">...</span>
      </div>
    )
  }

  // Failed state with red scanlines
  if (status === "failed") {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-muted scanlines-failed",
          className,
        )}
      >
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
