import { useMutation } from "@tanstack/react-query"
import { BracesIcon, MoreHorizontalIcon, RefreshCwIcon, Trash2Icon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { Tag } from "@/components/tag"
import { Thumbnail, THUMBNAIL_SIZE } from "@/components/thumbnail"
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { formatFalEndpointId } from "@/lib/format-endpoint"
import { client, queryClient } from "@/utils/orpc"

type Generation = {
  id: string
  slug: string | null
  model: string
  status: "pending" | "ready" | "failed"
  contentType: string | null
  input: Record<string, unknown>
  tags: string[]
  createdAt: Date
}

function getPrompt(input: Record<string, unknown>): string | null {
  if (typeof input.prompt === "string") return input.prompt
  return null
}

export function GenerationCard({
  generation,
  maxWidth = THUMBNAIL_SIZE,
  onViewJson,
  onSelect,
}: {
  generation: Generation
  maxWidth?: number
  onViewJson?: (generation: Generation) => void
  onSelect?: (id: string) => void
}) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const prompt = getPrompt(generation.input)

  const deleteMutation = useMutation({
    mutationFn: () => client.generations.delete({ id: generation.id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["generations"] })
      setShowDeleteDialog(false)
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete generation")
    },
  })

  const regenerateMutation = useMutation({
    mutationFn: () => client.generations.regenerate({ id: generation.id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["generations"] })
      toast.success("Regeneration submitted")
    },
    onError: (error) => {
      toast.error(error.message || "Failed to regenerate")
    },
  })

  const cardClassName =
    "group border border-border bg-card hover:border-muted-foreground/50 transition-colors block cursor-pointer"

  const cardContent = (
    <>
      <div className="aspect-square overflow-hidden bg-muted">
        <Thumbnail
          generationId={generation.id}
          contentType={generation.contentType}
          status={generation.status}
          className="w-full h-full"
        />
      </div>

      <div className="p-2 space-y-1.5 border-t border-border">
        <div className="flex items-center justify-between">
          <span className="font-mono text-xs text-muted-foreground truncate">
            {generation.slug ?? generation.id}
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  size="icon-xs"
                  variant="ghost"
                  className="opacity-0 group-hover:opacity-100"
                  onClick={(e) => e.preventDefault()}
                >
                  <MoreHorizontalIcon />
                </Button>
              }
            />
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              {onViewJson && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.preventDefault()
                    onViewJson(generation)
                  }}
                >
                  <BracesIcon />
                  view json
                </DropdownMenuItem>
              )}
              {generation.status === "failed" && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.preventDefault()
                    regenerateMutation.mutate()
                  }}
                  disabled={regenerateMutation.isPending}
                >
                  <RefreshCwIcon />
                  regenerate
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onClick={(e) => {
                  e.preventDefault()
                  setShowDeleteDialog(true)
                }}
                variant="destructive"
              >
                <Trash2Icon />
                delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {prompt && (
          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{prompt}</p>
        )}

        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <span className="truncate max-w-[120px]">{formatFalEndpointId(generation.model)}</span>
          <span>·</span>
          <TimeAgo date={new Date(generation.createdAt)} />
        </div>

        {generation.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {generation.tags.slice(0, 3).map((tag) => (
              <Tag key={tag} className="text-[10px]">
                {tag}
              </Tag>
            ))}
            {generation.tags.length > 3 && (
              <span className="text-[10px] text-muted-foreground">
                +{generation.tags.length - 3}
              </span>
            )}
          </div>
        )}
      </div>
    </>
  )

  return (
    <>
      <div
        className={cardClassName}
        style={{ maxWidth }}
        onClick={onSelect ? () => onSelect(generation.id) : undefined}
        onKeyDown={
          onSelect
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault()
                  onSelect(generation.id)
                }
              }
            : undefined
        }
        role={onSelect ? "button" : undefined}
        tabIndex={onSelect ? 0 : undefined}
      >
        {cardContent}
      </div>

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
    </>
  )
}
