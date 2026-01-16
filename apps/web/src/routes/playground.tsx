import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Plus, Send, X } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { client, queryClient } from "@/utils/orpc";

export const Route = createFileRoute("/playground")({
  component: PlaygroundPage,
});

const COMMON_ENDPOINTS = [
  "fal-ai/flux/schnell",
  "fal-ai/flux/dev",
  "fal-ai/flux-pro/v1.1",
  "fal-ai/recraft-v3",
  "fal-ai/stable-diffusion-v3-medium",
  "fal-ai/kling-video/v1/standard/image-to-video",
  "fal-ai/minimax/video-01",
] as const;

const DEFAULT_INPUT = `{
  "prompt": ""
}`;

function PlaygroundPage() {
  const navigate = useNavigate();
  const [endpoint, setEndpoint] = useState("fal-ai/flux/schnell");
  const [inputJson, setInputJson] = useState(DEFAULT_INPUT);
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: async () => {
      let parsedInput: Record<string, unknown>;
      try {
        parsedInput = JSON.parse(inputJson);
        setJsonError(null);
      } catch {
        throw new Error("Invalid JSON input");
      }

      return client.artifacts.create({
        endpoint,
        input: parsedInput,
        tags,
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["artifacts"] });
      toast.success("Artifact created");
      navigate({ to: "/artifacts/$id", params: { id: data.id } });
    },
    onError: (error) => {
      if (error.message === "Invalid JSON input") {
        setJsonError("Invalid JSON format");
      }
    },
  });

  const handleAddTag = () => {
    const trimmed = newTag.trim();
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
      setNewTag("");
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const handleJsonChange = (value: string) => {
    setInputJson(value);
    try {
      JSON.parse(value);
      setJsonError(null);
    } catch {
      setJsonError("Invalid JSON");
    }
  };

  return (
    <div className="container mx-auto max-w-3xl px-4 py-4">
      <h1 className="mb-6 text-xl font-semibold">Playground</h1>

      <div className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="endpoint">Endpoint</Label>
          <div className="flex gap-2">
            <Input
              id="endpoint"
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              placeholder="fal-ai/flux/schnell"
              className="flex-1 font-mono"
            />
            <Select
              onValueChange={(value: string | null) => {
                if (value) setEndpoint(value);
              }}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Presets" />
              </SelectTrigger>
              <SelectContent>
                {COMMON_ENDPOINTS.map((ep) => (
                  <SelectItem key={ep} value={ep}>
                    {ep.replace("fal-ai/", "")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="input">Input (JSON)</Label>
          <Textarea
            id="input"
            value={inputJson}
            onChange={(e) => handleJsonChange(e.target.value)}
            placeholder='{"prompt": "a cat wearing a hat"}'
            className="min-h-[200px] font-mono text-sm"
          />
          {jsonError && <p className="text-sm text-destructive">{jsonError}</p>}
        </div>

        <div className="space-y-2">
          <Label>Tags</Label>
          <div className="flex flex-wrap items-center gap-2">
            {tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="gap-1">
                {tag}
                <button
                  type="button"
                  onClick={() => handleRemoveTag(tag)}
                  className="ml-1 rounded hover:bg-muted"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            <div className="flex items-center gap-1">
              <Input
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddTag())}
                placeholder="Add tag"
                className="h-8 w-28 text-sm"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={handleAddTag}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <Button
          onClick={() => createMutation.mutate()}
          disabled={createMutation.isPending || !!jsonError || !endpoint.trim()}
          className="w-full"
        >
          {createMutation.isPending ? (
            "Creating..."
          ) : (
            <>
              <Send className="mr-2 h-4 w-4" />
              Submit
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
