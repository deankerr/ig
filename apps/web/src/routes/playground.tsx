import { useMutation } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { SendIcon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { SidebarLayout, PageHeader, PageContent } from "@/components/layout"
import { Tag } from "@/components/tag"
import { TagInput } from "@/components/tag-input"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { normalizeSlug } from "@/lib/format"
import { createGenerationOptions, invalidateGenerations } from "@/queries/generations"

export const Route = createFileRoute("/playground")({
  component: PlaygroundPage,
})

const DEFAULT_INPUT = `{
  "prompt": ""
}`

function PlaygroundPage() {
  const navigate = useNavigate()
  const [model, setModel] = useState("fal-ai/flux/schnell")
  const [inputJson, setInputJson] = useState(DEFAULT_INPUT)
  const [tags, setTags] = useState<string[]>([])
  const [slug, setSlug] = useState("")
  const [autoAspectRatio, setAutoAspectRatio] = useState(false)
  const [jsonError, setJsonError] = useState<string | null>(null)

  const createMutation = useMutation({
    ...createGenerationOptions(),
    onSuccess: (data) => {
      invalidateGenerations()
      toast.success("Generation submitted")
      navigate({ to: "/generations", search: { selected: data.id } })
    },
    onError: (error) => {
      if (error.message === "Invalid JSON input") {
        setJsonError("Invalid JSON format")
      } else {
        toast.error(error.message || "Failed to submit generation")
      }
    },
  })

  function handleSubmit() {
    let parsedInput: Record<string, unknown>
    try {
      parsedInput = JSON.parse(inputJson)
      setJsonError(null)
    } catch {
      setJsonError("Invalid JSON format")
      return
    }

    createMutation.mutate({
      provider: model.includes("@") ? "runware" : "fal",
      model,
      input: parsedInput,
      tags,
      slug: slug.trim() || undefined,
      autoAspectRatio: autoAspectRatio || undefined,
    })
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
                  onClick={handleSubmit}
                  disabled={createMutation.isPending || !!jsonError || !model.trim()}
                  className="h-7 text-xs"
                >
                  {createMutation.isPending ? (
                    "submitting..."
                  ) : (
                    <>
                      <SendIcon data-icon="inline-start" />
                      submit
                    </>
                  )}
                </Button>
              </div>
            </PageHeader>

            <PageContent className="p-0 flex-1 flex flex-col">
              {/* Model selector */}
              <div className="border-b border-border p-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-16">model</span>
                  <div className="flex-1">
                    <Input
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      placeholder="fal-ai/... or civitai:...@..."
                      className="font-mono text-sm"
                    />
                  </div>
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
            {/* Slug */}
            <div className="p-4 border-b border-border">
              <h3 className="text-xs text-muted-foreground mb-2">slug</h3>
              <Input
                value={slug}
                onChange={(e) => setSlug(normalizeSlug(e.target.value))}
                placeholder="optional-url-slug"
                className="h-7 text-xs font-mono"
              />
            </div>

            {/* Options */}
            <div className="p-4 border-b border-border">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoAspectRatio}
                  onChange={(e) => setAutoAspectRatio(e.target.checked)}
                  className="size-3.5 accent-primary"
                />
                <span className="text-xs">auto aspect ratio</span>
              </label>
            </div>

            {/* Tags */}
            <div className="p-4 border-b border-border">
              <h3 className="text-xs text-muted-foreground mb-2">tags</h3>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {tags.map((tag) => (
                    <Tag key={tag} onRemove={() => handleRemoveTag(tag)}>
                      {tag}
                    </Tag>
                  ))}
                </div>
              )}
              <TagInput
                onAdd={(tag) => {
                  if (!tags.includes(tag)) {
                    setTags([...tags, tag])
                  }
                }}
              />
            </div>
          </div>
        }
      />
    </div>
  )
}
