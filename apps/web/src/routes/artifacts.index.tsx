import { useState } from "react";
import { useInfiniteQuery, useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { MoreHorizontal, RefreshCw, Trash2 } from "lucide-react";

import { StatusBadge } from "@/components/artifacts/status-badge";
import { TimeAgo } from "@/components/time-ago";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { client, queryClient } from "@/utils/orpc";

export const Route = createFileRoute("/artifacts/")({
  component: ArtifactsPage,
});

function ArtifactsPage() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const tagsQuery = useQuery({
    queryKey: ["artifacts", "tags"],
    queryFn: () => client.artifacts.listTags(),
  });

  const artifactsQuery = useInfiniteQuery({
    queryKey: ["artifacts", "list", { status: statusFilter }],
    queryFn: async ({ pageParam }) => {
      return client.artifacts.list({
        status:
          statusFilter === "all" ? undefined : (statusFilter as "creating" | "ready" | "failed"),
        limit: 20,
        cursor: pageParam,
      });
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => client.artifacts.delete({ id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["artifacts"] });
      setDeleteTarget(null);
    },
  });

  const retryMutation = useMutation({
    mutationFn: (id: string) => client.artifacts.retry({ id }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["artifacts"] });
      navigate({ to: "/artifacts/$id", params: { id: data.id } });
    },
  });

  const allArtifacts = artifactsQuery.data?.pages.flatMap((page) => page.items) ?? [];

  const handleStatusChange = (value: string | null) => {
    if (value) setStatusFilter(value);
  };

  return (
    <div className="container mx-auto max-w-6xl px-4 py-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Artifacts</h1>
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={handleStatusChange}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Filter status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="creating">Creating</SelectItem>
              <SelectItem value="ready">Ready</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {tagsQuery.data && tagsQuery.data.tags.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-1">
          <span className="mr-2 text-sm text-muted-foreground">Tags:</span>
          {tagsQuery.data.tags.map((tag) => (
            <Badge key={tag} variant="outline" className="text-xs">
              {tag}
            </Badge>
          ))}
        </div>
      )}

      <div className="rounded border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[280px]">ID</TableHead>
              <TableHead className="w-[100px]">Status</TableHead>
              <TableHead>Endpoint</TableHead>
              <TableHead>Tags</TableHead>
              <TableHead className="w-[100px]">Created</TableHead>
              <TableHead className="w-[60px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {allArtifacts.length === 0 && !artifactsQuery.isLoading && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No artifacts found
                </TableCell>
              </TableRow>
            )}
            {allArtifacts.map((artifact) => (
              <TableRow key={artifact.id}>
                <TableCell className="font-mono text-sm">
                  <Link
                    to="/artifacts/$id"
                    params={{ id: artifact.id }}
                    className="hover:underline"
                  >
                    {artifact.id.slice(0, 8)}...{artifact.id.slice(-4)}
                  </Link>
                </TableCell>
                <TableCell>
                  <StatusBadge status={artifact.status} />
                </TableCell>
                <TableCell className="font-mono text-sm">{artifact.endpoint}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {artifact.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  <TimeAgo
                    date={new Date(artifact.createdAt)}
                    className="text-sm text-muted-foreground"
                  />
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={<Button variant="ghost" size="sm" className="h-8 w-8 p-0" />}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() =>
                          navigate({ to: "/artifacts/$id", params: { id: artifact.id } })
                        }
                      >
                        View Details
                      </DropdownMenuItem>
                      {artifact.status === "failed" && (
                        <DropdownMenuItem
                          onClick={() => retryMutation.mutate(artifact.id)}
                          disabled={retryMutation.isPending}
                        >
                          <RefreshCw className="mr-2 h-4 w-4" />
                          Retry
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        onClick={() => setDeleteTarget(artifact.id)}
                        variant="destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {artifactsQuery.hasNextPage && (
        <div className="mt-4 flex justify-center">
          <Button
            variant="outline"
            onClick={() => artifactsQuery.fetchNextPage()}
            disabled={artifactsQuery.isFetchingNextPage}
          >
            {artifactsQuery.isFetchingNextPage ? "Loading..." : "Load More"}
          </Button>
        </div>
      )}

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Artifact</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this artifact? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
