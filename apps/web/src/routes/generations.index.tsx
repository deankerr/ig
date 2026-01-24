import { useState } from "react"
import { useInfiniteQuery, useMutation } from "@tanstack/react-query"
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { MoreHorizontal, RefreshCw, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { PageHeader, PageContent } from "@/components/layout"
import { Tag } from "@/components/tag"
import { Thumbnail } from "@/components/thumbnail"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { client, queryClient } from "@/utils/orpc"

export const Route = createFileRoute("/generations/")({
  component: GenerationsPage,
})

type GenerationStatus = "pending" | "ready" | "failed"

function getPrompt(input: Record<string, unknown>): string | null {
  if (typeof input.prompt === "string") return input.prompt
  return null
}

function GenerationsPage() {
  const navigate = useNavigate()
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  const generationsQuery = useInfiniteQuery({
    queryKey: ["generations", "list", { status: statusFilter }],
    queryFn: async ({ pageParam }) => {
      return client.generations.list({
        status: statusFilter === "all" ? undefined : (statusFilter as GenerationStatus),
        limit: 24,
        cursor: pageParam,
      })
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    refetchInterval: statusFilter === "pending" || statusFilter === "all" ? 5000 : false,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => client.generations.delete({ id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["generations"] })
      setDeleteTarget(null)
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete generation")
    },
  })

  const regenerateMutation = useMutation({
    mutationFn: (id: string) => client.generations.regenerate({ id }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["generations"] })
      navigate({ to: "/generations/$id", params: { id: data.id } })
    },
    onError: (error) => {
      toast.error(error.message || "Failed to regenerate")
    },
  })

  const allGenerations = generationsQuery.data?.pages.flatMap((page) => page.items) ?? []

  return (
    <div className="flex flex-col h-full">
      <PageHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-sm font-medium">generations</h1>
            <span className="text-xs text-muted-foreground">{allGenerations.length} loaded</span>
          </div>
          <div className="flex items-center gap-2">
            <Select value={statusFilter} onValueChange={(v) => v && setStatusFilter(v)}>
              <SelectTrigger className="w-[120px] h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">all</SelectItem>
                <SelectItem value="pending">pending</SelectItem>
                <SelectItem value="ready">ready</SelectItem>
                <SelectItem value="failed">failed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </PageHeader>

      <PageContent>
        {allGenerations.length === 0 && !generationsQuery.isLoading && (
          <div className="text-center py-12 text-muted-foreground text-sm">
            no generations found
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 3xl:grid-cols-6 4xl:grid-cols-7 gap-3">
          {allGenerations.map((generation) => {
            const prompt = getPrompt(generation.input)

            return (
              <Link
                key={generation.id}
                to="/generations/$id"
                params={{ id: generation.id }}
                className="group border border-border bg-card hover:border-muted-foreground/50 transition-colors block"
              >
                {/* Thumbnail */}
                <div className="aspect-square overflow-hidden bg-muted">
                  <Thumbnail
                    generationId={generation.id}
                    contentType={generation.contentType}
                    status={generation.status}
                    className="w-full h-full"
                  />
                </div>

                {/* Info */}
                <div className="p-2 space-y-1.5 border-t border-border">
                  {/* UUID and actions */}
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-muted-foreground truncate">
                      {generation.id}
                    </span>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <button
                            className="p-1 opacity-0 group-hover:opacity-100 hover:bg-muted transition-all"
                            onClick={(e) => e.preventDefault()}
                          >
                            <MoreHorizontal className="h-3 w-3" />
                          </button>
                        }
                      />
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() =>
                            navigate({ to: "/generations/$id", params: { id: generation.id } })
                          }
                        >
                          view details
                        </DropdownMenuItem>
                        {generation.status === "failed" && (
                          <DropdownMenuItem
                            onClick={() => regenerateMutation.mutate(generation.id)}
                            disabled={regenerateMutation.isPending}
                          >
                            <RefreshCw className="mr-2 h-3 w-3" />
                            regenerate
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onClick={() => setDeleteTarget(generation.id)}
                          variant="destructive"
                        >
                          <Trash2 className="mr-2 h-3 w-3" />
                          delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Prompt preview */}
                  {prompt && (
                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                      {prompt}
                    </p>
                  )}

                  {/* Metadata row */}
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span className="truncate max-w-[120px]">
                      {generation.endpoint.replace("fal-ai/", "")}
                    </span>
                    <span>·</span>
                    <TimeAgo date={new Date(generation.createdAt)} />
                  </div>

                  {/* Tags */}
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
              </Link>
            )
          })}
        </div>

        {/* Load more */}
        {generationsQuery.hasNextPage && (
          <div className="mt-6 flex justify-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => generationsQuery.fetchNextPage()}
              disabled={generationsQuery.isFetchingNextPage}
            >
              {generationsQuery.isFetchingNextPage ? "loading..." : "load more"}
            </Button>
          </div>
        )}
      </PageContent>

      {/* Delete dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-mono text-base">delete generation</DialogTitle>
            <DialogDescription className="text-xs">
              This will permanently delete the generation and its output file.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setDeleteTarget(null)}>
              cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget)}
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
