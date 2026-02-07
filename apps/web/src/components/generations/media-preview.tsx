import { CheckIcon, CopyIcon, DownloadIcon, ExternalLinkIcon, RefreshCwIcon } from "lucide-react"
import { useState } from "react"
import { ActionLink } from "@/components/action-link"
import { PulsingDot } from "@/components/pulsing-dot"
import { Button } from "@/components/ui/button"
import type { Generation } from "@/types"

export function MediaPreview({
  generation,
  fileUrl,
  onRegenerate,
  isRegenerating,
}: {
  generation: Generation
  fileUrl: string
  onRegenerate: () => void
  isRegenerating: boolean
}) {
  const [copiedUrl, setCopiedUrl] = useState(false)

  const isImage = generation.contentType?.startsWith("image/")
  const isVideo = generation.contentType?.startsWith("video/")
  const isAudio = generation.contentType?.startsWith("audio/")

  async function copyFileUrl() {
    await navigator.clipboard.writeText(fileUrl)
    setCopiedUrl(true)
    setTimeout(() => setCopiedUrl(false), 1500)
  }

  if (generation.status === "pending") {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-muted-foreground text-sm">
          <PulsingDot className="size-8" />
          processing...
        </div>
      </div>
    )
  }

  if (generation.status === "failed") {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="border border-destructive/50 bg-destructive/10 p-6 max-w-md">
          <p className="text-sm text-destructive font-medium mb-2">
            {generation.errorCode ?? "Error"}
          </p>
          <p className="text-xs text-destructive/80">{generation.errorMessage}</p>
          <div className="mt-4">
            <Button variant="outline" size="sm" onClick={onRegenerate} disabled={isRegenerating}>
              <RefreshCwIcon data-icon="inline-start" />
              regenerate
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (generation.status !== "ready") return null

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {isImage && (
        <>
          <div className="flex-1 flex items-center justify-center min-h-0">
            <img
              src={fileUrl}
              alt=""
              className="max-w-full max-h-full object-contain border border-border"
            />
          </div>
          <div className="flex justify-center gap-2 pt-4 shrink-0">
            <ActionLink href={fileUrl}>
              <ExternalLinkIcon className="size-3" />
              open
            </ActionLink>
            <ActionLink href={fileUrl} download>
              <DownloadIcon className="size-3" />
              download
            </ActionLink>
            <ActionLink onClick={copyFileUrl}>
              {copiedUrl ? (
                <>
                  <CheckIcon className="size-3 text-status-ready" />
                  <span className="text-status-ready">copied</span>
                </>
              ) : (
                <>
                  <CopyIcon className="size-3" />
                  copy url
                </>
              )}
            </ActionLink>
          </div>
        </>
      )}
      {isVideo && (
        <div className="flex-1 flex items-center justify-center min-h-0">
          <video src={fileUrl} controls className="max-w-full max-h-full border border-border" />
        </div>
      )}
      {isAudio && (
        <div className="flex-1 flex items-center justify-center">
          <audio src={fileUrl} controls className="w-full max-w-lg" />
        </div>
      )}
      {!isImage && !isVideo && !isAudio && generation.contentType && (
        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground text-sm">
          <p>content type: {generation.contentType}</p>
          <div className="mt-4">
            <ActionLink href={fileUrl} download>
              <DownloadIcon className="size-3" />
              download file
            </ActionLink>
          </div>
        </div>
      )}
    </div>
  )
}
