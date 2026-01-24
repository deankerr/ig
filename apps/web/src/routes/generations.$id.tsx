import { useState } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import {
  ArrowLeft,
  Download,
  ExternalLink,
  Plus,
  RefreshCw,
  Trash2,
  Copy,
  Check,
} from "lucide-react"
import { toast } from "sonner"
import { SidebarLayout, PageHeader, PageContent } from "@/components/layout"
import { Copyable } from "@/components/copyable"
import { JsonViewer } from "@/components/generations/json-viewer"
import { Tag } from "@/components/tag"
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
import { Input } from "@/components/ui/input"
import { client, queryClient } from "@/utils/orpc"
import { env } from "@ig/env/web"

export const Route = createFileRoute("/generations/$id")({
  component: GenerationDetailPage,
})

function GenerationDetailPage() {
  const { id } = Route.useParams()
  const navigate = useNavigate()
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [newTag, setNewTag] = useState("")
  const [copiedUrl, setCopiedUrl] = useState(false)

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

  const updateTagsMutation = useMutation({
    mutationFn: (args: { add?: string[]; remove?: string[] }) =>
      client.generations.updateTags({ id, ...args }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["generations", "get", { id }] })
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update tags")
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

  function handleAddTag() {
    if (!generation) return
    if (newTag.trim() && !generation.tags.includes(newTag.trim())) {
      updateTagsMutation.mutate({ add: [newTag.trim()] })
      setNewTag("")
    }
  }

  function handleRemoveTag(tag: string) {
    updateTagsMutation.mutate({ remove: [tag] })
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
                  <ArrowLeft className="h-4 w-4" />
                  <span>back</span>
                </Link>
                <div className="flex items-center gap-2">
                  {generation.status === "failed" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => regenerateMutation.mutate()}
                      disabled={regenerateMutation.isPending}
                      className="h-7 text-xs"
                    >
                      <RefreshCw className="mr-1.5 h-3 w-3" />
                      regenerate
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowDeleteDialog(true)}
                    className="h-7 text-xs text-destructive hover:text-destructive"
                  >
                    <Trash2 className="mr-1.5 h-3 w-3" />
                    delete
                  </Button>
                </div>
              </div>
            </PageHeader>

            <PageContent>
              {generation.status === "ready" && (
                <>
                  {isImage && (
                    <div className="flex flex-col items-center gap-4">
                      <img
                        src={fileUrl}
                        alt=""
                        className="max-w-full max-h-[70vh] object-contain border border-border"
                      />
                      <div className="flex items-center gap-2">
                        <a
                          href={fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs border border-border hover:bg-muted transition-colors"
                        >
                          <ExternalLink className="h-3 w-3" />
                          open
                        </a>
                        <a
                          href={fileUrl}
                          download
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs border border-border hover:bg-muted transition-colors"
                        >
                          <Download className="h-3 w-3" />
                          download
                        </a>
                        <button
                          onClick={copyFileUrl}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs border border-border hover:bg-muted transition-colors"
                        >
                          {copiedUrl ? (
                            <>
                              <Check className="h-3 w-3 text-status-ready" />
                              <span className="text-status-ready">copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="h-3 w-3" />
                              copy url
                            </>
                          )}
                        </button>
                      </div>
                    </div>
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
                      <a
                        href={fileUrl}
                        download
                        className="inline-flex items-center gap-1.5 mt-4 px-3 py-1.5 text-xs border border-border hover:bg-muted transition-colors"
                      >
                        <Download className="h-3 w-3" />
                        download file
                      </a>
                    </div>
                  )}
                </>
              )}

              {generation.status === "pending" && (
                <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-status-pending opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-status-pending" />
                    </span>
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
              <span className="text-xs text-muted-foreground">id</span>
              <div className="mt-1">
                <Copyable text={generation.id} className="font-mono text-xs break-all">
                  {generation.id}
                </Copyable>
              </div>
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
              <div>
                <span className="text-xs text-muted-foreground">endpoint</span>
                <Copyable text={generation.endpoint} className="text-sm block">
                  {generation.endpoint}
                </Copyable>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">created</span>
                <p className="text-sm">
                  <TimeAgo date={new Date(generation.createdAt)} />
                  {completionTime && (
                    <span className="text-muted-foreground ml-2">({completionTime}s)</span>
                  )}
                </p>
              </div>
              {generation.contentType && (
                <div>
                  <span className="text-xs text-muted-foreground">content type</span>
                  <p className="text-sm">{generation.contentType}</p>
                </div>
              )}
              {generation.providerRequestId && (
                <div>
                  <span className="text-xs text-muted-foreground">provider request id</span>
                  <Copyable
                    text={generation.providerRequestId}
                    className="text-xs font-mono break-all block"
                  >
                    {generation.providerRequestId}
                  </Copyable>
                </div>
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
              <div className="flex items-center gap-1">
                <Input
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddTag()}
                  placeholder="add tag"
                  className="h-7 text-xs flex-1"
                />
                <button onClick={handleAddTag} className="p-1.5 hover:bg-muted transition-colors">
                  <Plus className="h-3 w-3" />
                </button>
              </div>
            </div>

            {/* JSON sections */}
            <div className="p-4 space-y-4">
              <JsonViewer
                data={generation.input}
                label="input"
                collapsible
                defaultCollapsed={!!prompt}
                maxHeight="300px"
              />
              {generation.providerMetadata && (
                <JsonViewer
                  data={generation.providerMetadata}
                  label="provider metadata"
                  collapsible
                  defaultCollapsed
                  maxHeight="300px"
                />
              )}
              <JsonViewer
                data={generation}
                label="raw"
                collapsible
                defaultCollapsed
                maxHeight="400px"
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
    </div>
  )
}
