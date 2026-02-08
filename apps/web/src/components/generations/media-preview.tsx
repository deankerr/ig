import { CheckIcon, CopyIcon, DownloadIcon, ExternalLinkIcon, RefreshCwIcon } from 'lucide-react'
import { useState } from 'react'

import { ActionLink } from '@/components/action-link'
import { PulsingDot } from '@/components/pulsing-dot'
import { Button } from '@/components/ui/button'
import type { Generation } from '@/types'

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

  const isImage = generation.contentType?.startsWith('image/')
  const isVideo = generation.contentType?.startsWith('video/')
  const isAudio = generation.contentType?.startsWith('audio/')

  async function copyFileUrl() {
    await navigator.clipboard.writeText(fileUrl)
    setCopiedUrl(true)
    setTimeout(() => setCopiedUrl(false), 1500)
  }

  if (generation.status === 'pending') {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-muted-foreground flex flex-col items-center gap-4 text-sm">
          <PulsingDot className="size-8" />
          processing...
        </div>
      </div>
    )
  }

  if (generation.status === 'failed') {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="border-destructive/50 bg-destructive/10 max-w-md border p-6">
          <p className="text-destructive mb-2 text-sm font-medium">
            {generation.errorCode ?? 'Error'}
          </p>
          <p className="text-destructive/80 text-xs">{generation.errorMessage}</p>
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

  if (generation.status !== 'ready') return null

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {isImage && (
        <>
          <div className="flex min-h-0 flex-1 items-center justify-center">
            <img
              src={fileUrl}
              alt=""
              className="border-border max-h-full max-w-full border object-contain"
            />
          </div>
          <div className="flex shrink-0 justify-center gap-2 pt-4">
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
                  <CheckIcon className="text-status-ready size-3" />
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
        <div className="flex min-h-0 flex-1 items-center justify-center">
          <video src={fileUrl} controls className="border-border max-h-full max-w-full border" />
        </div>
      )}
      {isAudio && (
        <div className="flex flex-1 items-center justify-center">
          <audio src={fileUrl} controls className="w-full max-w-lg" />
        </div>
      )}
      {!isImage && !isVideo && !isAudio && generation.contentType && (
        <div className="text-muted-foreground flex flex-1 flex-col items-center justify-center text-sm">
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
