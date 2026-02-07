import { useMutation, useQuery } from "@tanstack/react-query"
import { BracesIcon, ChevronLeftIcon, ChevronRightIcon, XIcon } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { GenerationSidebar } from "@/components/generations/generation-sidebar"
import { MediaPreview } from "@/components/generations/media-preview"
import { JsonSheet } from "@/components/json-sheet"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import {
  generationQueryOptions,
  regenerateGenerationOptions,
  invalidateGenerations,
} from "@/queries/generations"
import { serverUrl } from "@/lib/server-url"

type GenerationDetailModalProps = {
  generationId: string | null
  onClose: () => void
  onPrev?: () => void
  onNext?: () => void
  hasPrev?: boolean
  hasNext?: boolean
}

export function GenerationDetailModal({
  generationId,
  onClose,
  onPrev,
  onNext,
  hasPrev = false,
  hasNext = false,
}: GenerationDetailModalProps) {
  const [showJsonSheet, setShowJsonSheet] = useState(false)

  // Keyboard navigation - use capture phase to intercept before Dialog handles arrow keys
  useEffect(() => {
    if (!generationId) return

    function handleKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      if (e.key === "ArrowLeft" && hasPrev && onPrev) {
        e.preventDefault()
        e.stopPropagation()
        onPrev()
      } else if (e.key === "ArrowRight" && hasNext && onNext) {
        e.preventDefault()
        e.stopPropagation()
        onNext()
      }
    }

    window.addEventListener("keydown", handleKeyDown, { capture: true })
    return () => window.removeEventListener("keydown", handleKeyDown, { capture: true })
  }, [generationId, hasPrev, hasNext, onPrev, onNext])

  const generationQuery = useQuery(generationQueryOptions(generationId))

  const regenerateMutation = useMutation({
    ...regenerateGenerationOptions(),
    onSuccess: () => {
      invalidateGenerations()
      onClose()
      toast.success("Regeneration submitted")
    },
    onError: (error) => {
      toast.error(error.message || "Failed to regenerate")
    },
  })

  const generation = generationQuery.data
  const fileUrl = generationId ? new URL(`/generations/${generationId}/file`, serverUrl).href : ""

  return (
    <>
      <Dialog open={!!generationId} onOpenChange={(open) => !open && onClose()}>
        <DialogContent
          className="w-[95vw] h-[90vh] max-w-none sm:max-w-none p-0 flex flex-col gap-0"
          showCloseButton={false}
        >
          {/* Header with navigation */}
          <div className="flex items-center justify-between gap-4 px-4 py-3 border-b border-border shrink-0">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={onPrev}
                disabled={!hasPrev}
                aria-label="Previous generation"
              >
                <ChevronLeftIcon />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={onNext}
                disabled={!hasNext}
                aria-label="Next generation"
              >
                <ChevronRightIcon />
              </Button>
            </div>

            <div className="flex-1 text-center font-mono text-sm truncate">
              {generation?.slug ?? generation?.id ?? "Loading..."}
            </div>

            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setShowJsonSheet(true)}>
                <BracesIcon data-icon="inline-start" />
                json
              </Button>
              <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close">
                <XIcon />
              </Button>
            </div>
          </div>

          {/* Main content area with sidebar layout */}
          <div className="flex flex-1 min-h-0">
            <div className="flex-1 flex flex-col min-w-0 p-4">
              {generationQuery.isLoading && (
                <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
                  loading...
                </div>
              )}

              {generation && (
                <MediaPreview
                  generation={generation}
                  fileUrl={fileUrl}
                  onRegenerate={() =>
                    generationId && regenerateMutation.mutate({ id: generationId })
                  }
                  isRegenerating={regenerateMutation.isPending}
                />
              )}
            </div>

            {generation && generationId && (
              <GenerationSidebar
                generation={generation}
                generationId={generationId}
                onClose={onClose}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* JSON sheet */}
      {generation && (
        <JsonSheet
          data={generation}
          title={generation.slug ?? generation.id}
          open={showJsonSheet}
          onOpenChange={setShowJsonSheet}
        />
      )}
    </>
  )
}
