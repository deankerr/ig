import { useMutation, useQuery } from "@tanstack/react-query"
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import {
  ArrowLeftIcon,
  BracesIcon,
  CheckIcon,
  CopyIcon,
  DownloadIcon,
  ExternalLinkIcon,
  RefreshCwIcon,
  Trash2Icon,
} from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { Copyable } from "@/components/copyable"
import { JsonSheet } from "@/components/json-sheet"
import { SidebarLayout, PageHeader, PageContent } from "@/components/layout"
import { PulsingDot } from "@/components/pulsing-dot"
import { Tag } from "@/components/tag"
import { TagInput } from "@/components/tag-input"
import { TimeAgo } from "@/components/time-ago"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
import { client, queryClient } from "@/utils/orpc"
import { env } from "@ig/env/web"

export const Route = createFileRoute("/generations/$id")({
  component: GenerationDetailPage,
})

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

function GenerationDetailPage() {
  const { id } = Route.useParams()
  const navigate = useNavigate()
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [copiedUrl, setCopiedUrl] = useState(false)
  const [editingSlug, setEditingSlug] = useState(false)
  const [slugInput, setSlugInput] = useState("")
  const [showJsonSheet, setShowJsonSheet] = useState(false)

  const generationQuery = useQuery({
    queryKey: ["generations", "get", { id }],
    queryFn: () => client.generations.get({ id }),
    refetchInterval: (query) => (query.state.data?.status === "pending" ? 2000 : false),
  })

  const deleteMutation = useMutation({
    mutationFn: () => client.generations.delete({ id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["generations"] })
      navigate({ to: "/generations" })
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete generation")
    },
  })

  const regenerateMutation = useMutation({
    mutationFn: () => client.generations.regenerate({ id }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["generations"] })
      navigate({ to: "/generations/$id", params: { id: data.id } })
    },
    onError: (error) => {
      toast.error(error.message || "Failed to regenerate")
    },
  })

  const updateMutation = useMutation({
    mutationFn: (args: { add?: string[]; remove?: string[]; slug?: string }) =>
      client.generations.update({ id, ...args }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["generations", "get", { id }] })
      setEditingSlug(false)
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update")
    },
  })

  const generation = generationQuery.data

  if (generationQuery.isLoading) {
    return (
      <div className="p-4">
        <p className="text-muted-foreground text-sm">loading...</p>
      </div>
    )
  }

  if (!generation) {
    return (
      <div className="p-4">
        <p className="text-muted-foreground text-sm mb-2">generation not found</p>
        <Link to="/generations" className="text-xs text-primary hover:underline">
          ← back to generations
        </Link>
      </div>
    )
  }

  const fileUrl = `${env.VITE_SERVER_URL}/generations/${id}/file`
  const isImage = generation.contentType?.startsWith("image/")
  const isVideo = generation.contentType?.startsWith("video/")
  const isAudio = generation.contentType?.startsWith("audio/")
  const prompt = typeof generation.input.prompt === "string" ? generation.input.prompt : null

  function handleRemoveTag(tag: string) {
    updateMutation.mutate({ remove: [tag] })
  }

  async function copyFileUrl() {
    await navigator.clipboard.writeText(fileUrl)
    setCopiedUrl(true)
    setTimeout(() => setCopiedUrl(false), 1500)
  }

  const completionTime = generation.completedAt
    ? (
        (new Date(generation.completedAt).getTime() - new Date(generation.createdAt).getTime()) /
        1000
      ).toFixed(1)
    : null

  return (
    <div className="h-full">
      <SidebarLayout
        main={
          <>
            <PageHeader>
              <div className="flex items-center justify-between">
                <Link
                  to="/generations"
                  className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors text-sm"
                >
                  <ArrowLeftIcon className="size-4" />
                  <span>back</span>
                </Link>
                <div className="flex items-center gap-2">
                  {generation.status === "failed" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => regenerateMutation.mutate()}
                      disabled={regenerateMutation.isPending}
                    >
                      <RefreshCwIcon data-icon="inline-start" />
                      regenerate
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={() => setShowJsonSheet(true)}>
                    <BracesIcon data-icon="inline-start" />
                    json
                  </Button>
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
              </div>
            </PageHeader>

            <PageContent className={isImage ? "flex flex-col" : undefined}>
              {generation.status === "ready" && (
                <>
                  {isImage && (
                    <>
                      <div className="flex-1 flex items-center justify-center min-h-0">
                        <img
                          src={fileUrl}
                          alt=""
                          className="max-w-full max-h-full object-contain border border-border"
                        />
                      </div>
                      <div className="flex justify-center gap-2 pt-4">
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
                    <video
                      src={fileUrl}
                      controls
                      className="max-w-full max-h-[70vh] mx-auto border border-border"
                    />
                  )}
                  {isAudio && <audio src={fileUrl} controls className="w-full max-w-lg mx-auto" />}
                  {!isImage && !isVideo && !isAudio && generation.contentType && (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      <p>content type: {generation.contentType}</p>
                      <div className="mt-4">
                        <ActionLink href={fileUrl} download>
                          <DownloadIcon className="size-3" />
                          download file
                        </ActionLink>
                      </div>
                    </div>
                  )}
                </>
              )}

              {generation.status === "pending" && (
                <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
                  <div className="flex items-center gap-2">
                    <PulsingDot />
                    processing...
                  </div>
                </div>
              )}

              {generation.status === "failed" && (
                <div className="border border-destructive/50 bg-destructive/10 p-4">
                  <p className="text-sm text-destructive font-medium mb-1">
                    {generation.errorCode ?? "Error"}
                  </p>
                  <p className="text-xs text-destructive/80">{generation.errorMessage}</p>
                </div>
              )}
            </PageContent>
          </>
        }
        sidebar={
          <div className="divide-y divide-border">
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
                      onChange={(e) =>
                        setSlugInput(e.target.value.toLowerCase().replace(/[^a-z0-9-/]/g, ""))
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          updateMutation.mutate({ slug: slugInput })
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
                        onClick={() => updateMutation.mutate({ slug: slugInput })}
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
              <Field label="endpoint">
                <Copyable text={generation.endpoint} className="text-sm block">
                  {generation.endpoint}
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
                {generation.tags.map((tag) => (
                  <Tag key={tag} onRemove={() => handleRemoveTag(tag)}>
                    {tag}
                  </Tag>
                ))}
              </div>
              <TagInput
                onAdd={(tag) => {
                  if (!generation.tags.includes(tag)) {
                    updateMutation.mutate({ add: [tag] })
                  }
                }}
              />
            </div>
          </div>
        }
      />

      {/* Delete dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-mono text-base">delete generation</DialogTitle>
            <DialogDescription className="text-xs">
              This will permanently delete the generation and its output file.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowDeleteDialog(false)}>
              cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "deleting..." : "delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* JSON sheet */}
      <JsonSheet
        data={generation}
        title={generation.slug ?? generation.id}
        open={showJsonSheet}
        onOpenChange={setShowJsonSheet}
      />
    </div>
  )
}
