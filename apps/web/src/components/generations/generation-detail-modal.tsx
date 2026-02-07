import { useMutation, useQuery } from "@tanstack/react-query"
import {
  BracesIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CopyIcon,
  DownloadIcon,
  ExternalLinkIcon,
  RefreshCwIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Copyable } from "@/components/copyable"
import { DeleteGenerationDialog } from "@/components/delete-generation-dialog"
import { JsonSheet } from "@/components/json-sheet"
import { PulsingDot } from "@/components/pulsing-dot"
import { Tag } from "@/components/tag"
import { TagInput } from "@/components/tag-input"
import { TimeAgo } from "@/components/time-ago"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
import { formatDuration, normalizeSlug } from "@/lib/format"
import { formatFalEndpointId } from "@/lib/format-endpoint"
import {
  generationQueryOptions,
  regenerateGenerationOptions,
  updateGenerationOptions,
  invalidateGenerations,
  invalidateGeneration,
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="mt-1">{children}</div>
    </div>
  )
}

function ActionLink({
  href,
  download,
  onClick,
  children,
}: {
  href?: string
  download?: boolean
  onClick?: () => void
  children: React.ReactNode
}) {
  const className =
    "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs border border-border hover:bg-muted transition-colors"

  if (href) {
    return (
      <a
        href={href}
        target={download ? undefined : "_blank"}
        rel={download ? undefined : "noopener noreferrer"}
        download={download}
        className={className}
      >
        {children}
      </a>
    )
  }

  return (
    <button onClick={onClick} className={className}>
      {children}
    </button>
  )
}

export function GenerationDetailModal({
  generationId,
  onClose,
  onPrev,
  onNext,
  hasPrev = false,
  hasNext = false,
}: GenerationDetailModalProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showJsonSheet, setShowJsonSheet] = useState(false)
  const [copiedUrl, setCopiedUrl] = useState(false)
  const [editingSlug, setEditingSlug] = useState(false)
  const [slugInput, setSlugInput] = useState("")

  // Keyboard navigation - use capture phase to intercept before Dialog handles arrow keys
  useEffect(() => {
    if (!generationId) return

    function handleKeyDown(e: KeyboardEvent) {
      // Don't navigate if user is typing in an input
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

  const updateMutation = useMutation({
    ...updateGenerationOptions(),
    onSuccess: () => {
      if (generationId) invalidateGeneration(generationId)
      setEditingSlug(false)
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update")
    },
  })

  const generation = generationQuery.data

  const fileUrl = generationId ? new URL(`/generations/${generationId}/file`, serverUrl).href : ""
  const isImage = generation?.contentType?.startsWith("image/")
  const isVideo = generation?.contentType?.startsWith("video/")
  const isAudio = generation?.contentType?.startsWith("audio/")
  const prompt = typeof generation?.input.prompt === "string" ? generation.input.prompt : null

  function handleRemoveTag(tag: string) {
    if (generationId) updateMutation.mutate({ id: generationId, remove: [tag] })
  }

  async function copyFileUrl() {
    await navigator.clipboard.writeText(fileUrl)
    setCopiedUrl(true)
    setTimeout(() => setCopiedUrl(false), 1500)
  }

  const completionTime =
    generation?.completedAt && generation?.createdAt
      ? formatDuration(generation.createdAt, generation.completedAt)
      : null

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
            {/* Main area - large media display */}
            <div className="flex-1 flex flex-col min-w-0 p-4">
              {generationQuery.isLoading && (
                <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
                  loading...
                </div>
              )}

              {generation && (
                <>
                  {generation.status === "ready" && (
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
                          <video
                            src={fileUrl}
                            controls
                            className="max-w-full max-h-full border border-border"
                          />
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
                  )}

                  {generation.status === "pending" && (
                    <div className="flex-1 flex items-center justify-center">
                      <div className="flex flex-col items-center gap-4 text-muted-foreground text-sm">
                        <PulsingDot className="size-8" />
                        processing...
                      </div>
                    </div>
                  )}

                  {generation.status === "failed" && (
                    <div className="flex-1 flex items-center justify-center p-8">
                      <div className="border border-destructive/50 bg-destructive/10 p-6 max-w-md">
                        <p className="text-sm text-destructive font-medium mb-2">
                          {generation.errorCode ?? "Error"}
                        </p>
                        <p className="text-xs text-destructive/80">{generation.errorMessage}</p>
                        {generation.status === "failed" && (
                          <div className="mt-4">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                generationId && regenerateMutation.mutate({ id: generationId })
                              }
                              disabled={regenerateMutation.isPending}
                            >
                              <RefreshCwIcon data-icon="inline-start" />
                              regenerate
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Sidebar */}
            <aside className="w-80 border-l border-border bg-card overflow-y-auto shrink-0">
              {generation && (
                <div className="divide-y divide-border">
                  {/* Actions */}
                  <div className="p-4 flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowDeleteDialog(true)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2Icon data-icon="inline-start" />
                      delete
                    </Button>
                  </div>

                  {/* ID */}
                  <div className="p-4">
                    <Field label="id">
                      <Copyable text={generation.id} className="font-mono text-xs break-all">
                        {generation.id}
                      </Copyable>
                    </Field>
                  </div>

                  {/* Slug */}
                  <div className="p-4">
                    <Field label="slug">
                      {editingSlug ? (
                        <InputGroup className="h-7">
                          <InputGroupInput
                            value={slugInput}
                            onChange={(e) => setSlugInput(normalizeSlug(e.target.value))}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && generationId) {
                                updateMutation.mutate({ id: generationId, slug: slugInput })
                              } else if (e.key === "Escape") {
                                setEditingSlug(false)
                              }
                            }}
                            placeholder="custom-slug"
                            className="text-xs font-mono"
                            autoFocus
                          />
                          <InputGroupAddon align="inline-end">
                            <InputGroupButton
                              onClick={() =>
                                generationId &&
                                updateMutation.mutate({ id: generationId, slug: slugInput })
                              }
                              disabled={updateMutation.isPending}
                            >
                              {updateMutation.isPending ? "..." : "save"}
                            </InputGroupButton>
                          </InputGroupAddon>
                        </InputGroup>
                      ) : generation.slug ? (
                        <div className="flex items-center gap-2">
                          <Copyable text={generation.slug} className="font-mono text-xs break-all">
                            {generation.slug}
                          </Copyable>
                          <button
                            onClick={() => {
                              setSlugInput(generation.slug?.split("-").slice(1).join("-") ?? "")
                              setEditingSlug(true)
                            }}
                            className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                          >
                            edit
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setSlugInput("")
                            setEditingSlug(true)
                          }}
                          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                          + add slug
                        </button>
                      )}
                    </Field>
                  </div>

                  {/* Prompt section */}
                  {prompt && (
                    <div className="p-4">
                      <h3 className="text-xs text-muted-foreground mb-2">prompt</h3>
                      <Copyable text={prompt} className="text-sm leading-relaxed">
                        {prompt}
                      </Copyable>
                    </div>
                  )}

                  {/* Metadata */}
                  <div className="p-4 space-y-3">
                    <Field label="model">
                      <Copyable text={generation.model} className="text-sm block">
                        {formatFalEndpointId(generation.model)}
                      </Copyable>
                    </Field>
                    <Field label="created">
                      <p className="text-sm">
                        <TimeAgo date={new Date(generation.createdAt)} />
                        {completionTime && (
                          <span className="text-muted-foreground ml-2">({completionTime}s)</span>
                        )}
                      </p>
                    </Field>
                    {generation.contentType && (
                      <Field label="content type">
                        <p className="text-sm">{generation.contentType}</p>
                      </Field>
                    )}
                    {generation.providerRequestId && (
                      <Field label="provider request id">
                        <Copyable
                          text={generation.providerRequestId}
                          className="text-xs font-mono break-all block"
                        >
                          {generation.providerRequestId}
                        </Copyable>
                      </Field>
                    )}
                  </div>

                  {/* Tags */}
                  <div className="p-4">
                    <h3 className="text-xs text-muted-foreground mb-2">tags</h3>
                    <div className="flex flex-wrap items-center gap-1.5 mb-2">
                      {generation.tags.map((tag: string) => (
                        <Tag key={tag} onRemove={() => handleRemoveTag(tag)}>
                          {tag}
                        </Tag>
                      ))}
                    </div>
                    <TagInput
                      onAdd={(tag) => {
                        if (!generation.tags.includes(tag) && generationId) {
                          updateMutation.mutate({ id: generationId, add: [tag] })
                        }
                      }}
                    />
                  </div>
                </div>
              )}
            </aside>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      {generationId && (
        <DeleteGenerationDialog
          generationId={generationId}
          open={showDeleteDialog}
          onOpenChange={setShowDeleteDialog}
          onDeleted={onClose}
        />
      )}

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
