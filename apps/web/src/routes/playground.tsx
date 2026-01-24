import { useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { Plus, Send, ChevronDown } from "lucide-react"
import { toast } from "sonner"

import { SidebarLayout, PageHeader, PageContent } from "@/components/layout"
import { Tag } from "@/components/tag"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { client, queryClient } from "@/utils/orpc"

export const Route = createFileRoute("/playground")({
  component: PlaygroundPage,
})

const ENDPOINTS = [
  { id: "fal-ai/flux/schnell", label: "flux/schnell", description: "Fast text-to-image" },
  { id: "fal-ai/flux/dev", label: "flux/dev", description: "Development model" },
  { id: "fal-ai/flux-pro/v1.1", label: "flux-pro/v1.1", description: "Production quality" },
  { id: "fal-ai/recraft-v3", label: "recraft-v3", description: "Style-focused generation" },
  {
    id: "fal-ai/kling-video/v1/standard/image-to-video",
    label: "kling-video",
    description: "Image to video",
  },
  { id: "fal-ai/minimax/video-01", label: "minimax/video-01", description: "Video generation" },
] as const

const DEFAULT_INPUT = `{
  "prompt": ""
}`

function PlaygroundPage() {
  const navigate = useNavigate()
  const [endpoint, setEndpoint] = useState("fal-ai/flux/schnell")
  const [inputJson, setInputJson] = useState(DEFAULT_INPUT)
  const [tags, setTags] = useState<string[]>([])
  const [newTag, setNewTag] = useState("")
  const [jsonError, setJsonError] = useState<string | null>(null)

  const createMutation = useMutation({
    mutationFn: async () => {
      let parsedInput: Record<string, unknown>
      try {
        parsedInput = JSON.parse(inputJson)
        setJsonError(null)
      } catch {
        throw new Error("Invalid JSON input")
      }

      return client.generations.create({
        endpoint,
        input: parsedInput,
        tags,
      })
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["generations"] })
      toast.success("Generation submitted")
      navigate({ to: "/generations/$id", params: { id: data.id } })
    },
    onError: (error) => {
      if (error.message === "Invalid JSON input") {
        setJsonError("Invalid JSON format")
      } else {
        toast.error(error.message || "Failed to submit generation")
      }
    },
  })

  function handleAddTag() {
    const trimmed = newTag.trim()
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed])
      setNewTag("")
    }
  }

  function handleRemoveTag(tag: string) {
    setTags(tags.filter((t) => t !== tag))
  }

  function handleJsonChange(value: string) {
    setInputJson(value)
    try {
      JSON.parse(value)
      setJsonError(null)
    } catch {
      setJsonError("Invalid JSON")
    }
  }

  const selectedEndpoint = ENDPOINTS.find((e) => e.id === endpoint)

  return (
    <div className="h-full">
      <SidebarLayout
        sidebarWidth="w-64"
        main={
          <>
            <PageHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <h1 className="text-sm font-medium">playground</h1>
                </div>
                <Button
                  size="sm"
                  onClick={() => createMutation.mutate()}
                  disabled={createMutation.isPending || !!jsonError || !endpoint.trim()}
                  className="h-7 text-xs"
                >
                  {createMutation.isPending ? (
                    "submitting..."
                  ) : (
                    <>
                      <Send className="mr-1.5 h-3 w-3" />
                      submit
                    </>
                  )}
                </Button>
              </div>
            </PageHeader>

            <PageContent className="p-0 flex-1 flex flex-col">
              {/* Endpoint selector */}
              <div className="border-b border-border p-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-16">endpoint</span>
                  <Input
                    value={endpoint}
                    onChange={(e) => setEndpoint(e.target.value)}
                    placeholder="fal-ai/..."
                    className="flex-1 font-mono text-sm h-8"
                  />
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <button className="flex items-center gap-1 px-2 py-1.5 text-xs border border-border hover:bg-muted transition-colors">
                          presets
                          <ChevronDown className="h-3 w-3" />
                        </button>
                      }
                    />
                    <DropdownMenuContent align="end" className="w-64">
                      {ENDPOINTS.map((ep) => (
                        <DropdownMenuItem
                          key={ep.id}
                          onClick={() => setEndpoint(ep.id)}
                          className="flex flex-col items-start gap-0.5"
                        >
                          <span className="font-mono text-xs">{ep.label}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {ep.description}
                          </span>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {/* JSON input */}
              <div className="flex-1 flex flex-col min-h-[400px]">
                <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/30">
                  <span className="text-xs text-muted-foreground">input.json</span>
                  {jsonError && <span className="text-xs text-destructive">{jsonError}</span>}
                </div>
                <textarea
                  value={inputJson}
                  onChange={(e) => handleJsonChange(e.target.value)}
                  className="flex-1 w-full p-4 bg-transparent text-sm font-mono leading-relaxed resize-none focus:outline-none"
                  placeholder='{"prompt": "..."}'
                  spellCheck={false}
                />
              </div>
            </PageContent>
          </>
        }
        sidebar={
          <div className="flex flex-col h-full">
            <div className="p-4 border-b border-border">
              <h3 className="text-xs text-muted-foreground mb-3">tags</h3>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {tags.map((tag) => (
                  <Tag key={tag} onRemove={() => handleRemoveTag(tag)}>
                    {tag}
                  </Tag>
                ))}
              </div>
              <div className="flex items-center gap-1">
                <Input
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      handleAddTag()
                    }
                  }}
                  placeholder="add tag"
                  className="h-7 text-xs flex-1"
                />
                <button onClick={handleAddTag} className="p-1.5 hover:bg-muted transition-colors">
                  <Plus className="h-3 w-3" />
                </button>
              </div>
            </div>

            {/* Quick info */}
            <div className="p-4 space-y-3">
              <div>
                <span className="text-xs text-muted-foreground">selected</span>
                <p className="text-sm font-mono truncate">{selectedEndpoint?.label ?? endpoint}</p>
              </div>
              {selectedEndpoint && (
                <div>
                  <span className="text-xs text-muted-foreground">description</span>
                  <p className="text-xs text-muted-foreground">{selectedEndpoint.description}</p>
                </div>
              )}
            </div>

            {/* Tips */}
            <div className="mt-auto p-4 border-t border-border">
              <h4 className="text-xs text-muted-foreground mb-2">tips</h4>
              <ul className="text-[10px] text-muted-foreground space-y-1">
                <li>• Most endpoints accept a "prompt" field</li>
                <li>• Add tags to organize generations</li>
                <li>• Results appear in the generations list</li>
              </ul>
            </div>
          </div>
        }
      />
    </div>
  )
}
