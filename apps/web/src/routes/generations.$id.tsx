import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Download, ExternalLink, Plus, RefreshCw, Trash2, X } from "lucide-react";

import { JsonViewer } from "@/components/generations/json-viewer";
import { StatusBadge } from "@/components/generations/status-badge";
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
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { client, queryClient } from "@/utils/orpc";
import { env } from "@ig/env/web";

export const Route = createFileRoute("/generations/$id")({
  component: GenerationDetailPage,
});

function GenerationDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [newTag, setNewTag] = useState("");

  const generationQuery = useQuery({
    queryKey: ["generations", "get", { id }],
    queryFn: () => client.generations.get({ id }),
    refetchInterval: (query) => (query.state.data?.status === "pending" ? 2000 : false),
  });

  const deleteMutation = useMutation({
    mutationFn: () => client.generations.delete({ id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["generations"] });
      navigate({ to: "/generations" });
    },
  });

  const regenerateMutation = useMutation({
    mutationFn: () => client.generations.regenerate({ id }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["generations"] });
      navigate({ to: "/generations/$id", params: { id: data.id } });
    },
  });

  const updateTagsMutation = useMutation({
    mutationFn: (args: { add?: string[]; remove?: string[] }) =>
      client.generations.updateTags({ id, ...args }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["generations", "get", { id }] });
    },
  });

  const generation = generationQuery.data;

  if (generationQuery.isLoading) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-4">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!generation) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-4">
        <p className="text-muted-foreground">Generation not found</p>
        <Link to="/generations" className="text-sm hover:underline">
          ← Back to generations
        </Link>
      </div>
    );
  }

  const fileUrl = `${env.VITE_SERVER_URL}/generations/${id}/file`;
  const isImage = generation.contentType?.startsWith("image/");
  const isVideo = generation.contentType?.startsWith("video/");
  const isAudio = generation.contentType?.startsWith("audio/");

  const handleAddTag = () => {
    if (newTag.trim() && !generation.tags.includes(newTag.trim())) {
      updateTagsMutation.mutate({ add: [newTag.trim()] });
      setNewTag("");
    }
  };

  const handleRemoveTag = (tag: string) => {
    updateTagsMutation.mutate({ remove: [tag] });
  };

  return (
    <div className="container mx-auto max-w-4xl px-4 py-4">
      <div className="mb-4">
        <Link
          to="/generations"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back to generations
        </Link>
      </div>

      <div className="mb-4 flex items-start justify-between">
        <div>
          <h1 className="font-mono text-lg">{generation.id}</h1>
          <div className="mt-1 flex items-center gap-2">
            <StatusBadge status={generation.status} />
            <span className="text-sm text-muted-foreground">
              Created <TimeAgo date={new Date(generation.createdAt)} />
            </span>
            {generation.completedAt && (
              <span className="text-sm text-muted-foreground">
                · Completed in{" "}
                {(
                  (new Date(generation.completedAt).getTime() -
                    new Date(generation.createdAt).getTime()) /
                  1000
                ).toFixed(1)}
                s
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {generation.status === "failed" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => regenerateMutation.mutate()}
              disabled={regenerateMutation.isPending}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Regenerate
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setShowDeleteDialog(true)}>
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      <Separator className="my-4" />

      <div className="mb-4">
        <div className="mb-2 flex items-center gap-2">
          <span className="text-sm font-medium">Tags</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {generation.tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="gap-1">
              {tag}
              <button onClick={() => handleRemoveTag(tag)} className="ml-1 rounded hover:bg-muted">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          <div className="flex items-center gap-1">
            <Input
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddTag()}
              placeholder="Add tag"
              className="h-7 w-24 text-sm"
            />
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handleAddTag}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="input">Input</TabsTrigger>
          <TabsTrigger value="output">Output</TabsTrigger>
          <TabsTrigger value="raw">Raw</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Endpoint</span>
                <p className="font-mono">{generation.endpoint}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Provider Request ID</span>
                <p className="font-mono">{generation.providerRequestId ?? "—"}</p>
              </div>
              {generation.contentType && (
                <div>
                  <span className="text-muted-foreground">Content Type</span>
                  <p className="font-mono">{generation.contentType}</p>
                </div>
              )}
              {generation.errorCode && (
                <div>
                  <span className="text-muted-foreground">Error Code</span>
                  <p className="font-mono text-destructive">{generation.errorCode}</p>
                </div>
              )}
            </div>

            {generation.errorMessage && (
              <div className="rounded border border-destructive/50 bg-destructive/10 p-3">
                <p className="text-sm text-destructive">{generation.errorMessage}</p>
              </div>
            )}

            {generation.status === "ready" && (
              <div className="space-y-2">
                {isImage && (
                  <img
                    src={fileUrl}
                    alt="Generated content"
                    className="max-h-[500px] rounded border object-contain"
                  />
                )}
                {isVideo && (
                  <video src={fileUrl} controls className="max-h-[500px] rounded border" />
                )}
                {isAudio && <audio src={fileUrl} controls className="w-full" />}
                <div className="flex gap-2">
                  <a
                    href={fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-8 items-center justify-center gap-1.5 rounded-none border border-border bg-background px-2.5 text-xs font-medium transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Open
                  </a>
                  <a
                    href={fileUrl}
                    download
                    className="inline-flex h-8 items-center justify-center gap-1.5 rounded-none border border-border bg-background px-2.5 text-xs font-medium transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <Download className="h-4 w-4" />
                    Download
                  </a>
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="input" className="mt-4">
          <JsonViewer data={generation.input} maxHeight="500px" />
        </TabsContent>

        <TabsContent value="output" className="mt-4">
          {generation.providerMetadata ? (
            <JsonViewer data={generation.providerMetadata} maxHeight="500px" />
          ) : (
            <p className="text-muted-foreground">No output data available</p>
          )}
        </TabsContent>

        <TabsContent value="raw" className="mt-4">
          <JsonViewer data={generation} maxHeight="600px" />
        </TabsContent>
      </Tabs>

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Generation</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this generation? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteMutation.mutate()}
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
