import { useMutation, useQuery } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import {
  CheckIcon,
  ChevronDownIcon,
  PencilIcon,
  SaveIcon,
  SendIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { useAllModels } from "@/hooks/use-all-models"
import { SidebarLayout, PageHeader, PageContent } from "@/components/layout"
import { ModelItem } from "@/components/model-item"
import { Tag } from "@/components/tag"
import { TagInput } from "@/components/tag-input"
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
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  Autocomplete,
  AutocompleteInput,
  AutocompletePopup,
  AutocompleteList,
  AutocompleteItem,
  AutocompleteEmpty,
} from "@/components/ui/autocomplete"
import { formatFalEndpointId } from "@/lib/format-endpoint"
import { filterModelForAutocomplete } from "@/lib/fuzzy-search"
import { client, queryClient } from "@/utils/orpc"

export const Route = createFileRoute("/playground")({
  component: PlaygroundPage,
})

const QUICK_START_MODELS = [
  "fal-ai/flux/schnell",
  "fal-ai/flux/dev",
  "fal-ai/flux-pro/v1.1",
  "fal-ai/recraft-v3",
  "fal-ai/kling-video/v1/standard/image-to-video",
  "fal-ai/minimax/video-01",
] as const

const DEFAULT_INPUT = `{
  "prompt": ""
}`

function PlaygroundPage() {
  const navigate = useNavigate()
  const { models } = useAllModels()
  const [model, setModel] = useState("fal-ai/flux/schnell")
  const [inputJson, setInputJson] = useState(DEFAULT_INPUT)
  const [tags, setTags] = useState<string[]>([])
  const [slug, setSlug] = useState("")
  const [autoAspectRatio, setAutoAspectRatio] = useState(false)
  const [jsonError, setJsonError] = useState<string | null>(null)
  const [selectedPresetName, setSelectedPresetName] = useState<string | null>(null)
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [presetNameInput, setPresetNameInput] = useState("")
  const [presetDescriptionInput, setPresetDescriptionInput] = useState("")

  // Edit mode state for preset metadata
  const [isEditingPreset, setIsEditingPreset] = useState(false)
  const [editPresetName, setEditPresetName] = useState("")
  const [editPresetDescription, setEditPresetDescription] = useState("")

  // Track original preset values for modification detection
  const [originalPresetValues, setOriginalPresetValues] = useState<{
    model: string
    input: string
    tags: string[]
  } | null>(null)

  const presetsQuery = useQuery({
    queryKey: ["presets", "list"],
    queryFn: () => client.presets.list(),
  })

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
        provider: model.includes("@") ? "runware" : "fal",
        model,
        input: parsedInput,
        tags,
        slug: slug.trim() || undefined,
        autoAspectRatio: autoAspectRatio || undefined,
      })
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["generations"] })
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

  const savePresetMutation = useMutation({
    mutationFn: async (name: string) => {
      const parsedInput = JSON.parse(inputJson)
      return client.presets.create({
        name,
        description: presetDescriptionInput.trim() || undefined,
        model,
        input: parsedInput,
        tags: tags.length > 0 ? tags : undefined,
      })
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["presets"] })
      setSelectedPresetName(data.name)
      setShowSaveDialog(false)
      setPresetNameInput("")
      setPresetDescriptionInput("")
      toast.success("Preset saved")
    },
    onError: (error) => toast.error(error.message || "Failed to save preset"),
  })

  const deletePresetMutation = useMutation({
    mutationFn: (name: string) => client.presets.delete({ name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["presets"] })
      setSelectedPresetName(null)
      toast.success("Preset deleted")
    },
    onError: (error) => toast.error(error.message || "Failed to delete preset"),
  })

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

  type Preset = NonNullable<typeof presetsQuery.data>["items"][number]

  function handleSelectPreset(preset: Preset) {
    const inputStr = preset.input ? JSON.stringify(preset.input, null, 2) : DEFAULT_INPUT
    const presetTags = (preset.tags as string[]) ?? []

    setSelectedPresetName(preset.name)
    setModel(preset.model)
    setInputJson(inputStr)
    setTags(presetTags)
    setPresetDescriptionInput(preset.description ?? "")
    setIsEditingPreset(false)

    // Store original values for modification detection
    setOriginalPresetValues({
      model: preset.model,
      input: inputStr,
      tags: presetTags,
    })
  }

  function handleSelectQuickStart(modelId: string) {
    setSelectedPresetName(null)
    setModel(modelId)
    setOriginalPresetValues(null)
    setIsEditingPreset(false)
  }

  function handleModelChange(value: string) {
    setModel(value)
    if (selectedPresetName) setSelectedPresetName(null)
  }

  const selectedModelEntry = models.find((m) => m.endpointId === model)
  const quickStartModels = models.filter((m) =>
    QUICK_START_MODELS.includes(m.endpointId as (typeof QUICK_START_MODELS)[number]),
  )
  const presets = presetsQuery.data?.items ?? []
  const selectedPreset = presets.find((p) => p.name === selectedPresetName)

  // Detect if form has been modified from the selected preset
  const isModified =
    originalPresetValues !== null &&
    (model !== originalPresetValues.model ||
      inputJson !== originalPresetValues.input ||
      JSON.stringify(tags) !== JSON.stringify(originalPresetValues.tags))

  function handleStartEditPreset() {
    if (selectedPreset) {
      setEditPresetName(selectedPreset.name)
      setEditPresetDescription(selectedPreset.description ?? "")
      setIsEditingPreset(true)
    }
  }

  function handleCancelEditPreset() {
    setIsEditingPreset(false)
    setEditPresetName("")
    setEditPresetDescription("")
  }

  async function handleSavePresetMetadata() {
    if (!selectedPreset) return

    const nameChanged = editPresetName !== selectedPreset.name
    const descriptionChanged = editPresetDescription !== (selectedPreset.description ?? "")

    if (!nameChanged && !descriptionChanged) {
      setIsEditingPreset(false)
      return
    }

    // If name changed, we need to delete the old and create with the new name
    if (nameChanged) {
      await deletePresetMutation.mutateAsync(selectedPreset.name)
    }

    // Set description state before mutation (mutation reads from this)
    setPresetDescriptionInput(editPresetDescription)
    await savePresetMutation.mutateAsync(editPresetName)

    // Update selected preset name if it changed
    if (nameChanged) {
      setSelectedPresetName(editPresetName)
    }

    setIsEditingPreset(false)
  }

  function handleUpdatePreset() {
    if (selectedPresetName) {
      savePresetMutation.mutate(selectedPresetName)
    }
  }

  function handleOpenSaveDialog() {
    setPresetNameInput("ig/")
    setPresetDescriptionInput("")
    setShowSaveDialog(true)
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
                  onClick={() => createMutation.mutate()}
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
                    <Autocomplete
                      items={models}
                      value={model}
                      onValueChange={handleModelChange}
                      itemToStringValue={(m) => m.endpointId}
                      filter={filterModelForAutocomplete}
                    >
                      <AutocompleteInput placeholder="fal-ai/..." className="font-mono text-sm" />
                      <AutocompletePopup>
                        <AutocompleteList>
                          {(model) => (
                            <AutocompleteItem value={model} key={model.endpointId}>
                              <ModelItem model={model} />
                            </AutocompleteItem>
                          )}
                        </AutocompleteList>
                        <AutocompleteEmpty />
                      </AutocompletePopup>
                    </Autocomplete>
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
            {/* Preset */}
            <div className="p-4 border-b border-border">
              {/* Header with dropdown and action buttons */}
              <div className="flex items-center justify-between mb-2 h-6">
                <div className="flex items-center gap-1">
                  <h3 className="text-xs text-muted-foreground">preset</h3>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button size="icon-xs" variant="ghost">
                          <ChevronDownIcon />
                        </Button>
                      }
                    />
                    <DropdownMenuContent align="start" className="w-56">
                      {presets.length > 0 && (
                        <>
                          <DropdownMenuGroup>
                            <DropdownMenuLabel>your presets</DropdownMenuLabel>
                            {presets.map((preset) => (
                              <DropdownMenuItem
                                key={preset.name}
                                onClick={() => handleSelectPreset(preset)}
                                className="flex flex-col items-start gap-0.5"
                              >
                                <span className="font-mono text-xs">{preset.name}</span>
                                <span className="text-[10px] text-muted-foreground">
                                  {preset.description ||
                                    formatFalEndpointId(preset.model ?? preset.name)}
                                </span>
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuGroup>
                          <DropdownMenuSeparator />
                        </>
                      )}
                      <DropdownMenuGroup>
                        <DropdownMenuLabel>quick start</DropdownMenuLabel>
                        {quickStartModels.map((model) => (
                          <DropdownMenuItem
                            key={model.endpointId}
                            onClick={() => handleSelectQuickStart(model.endpointId)}
                          >
                            <ModelItem model={model} />
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                {selectedPresetName && !isEditingPreset && (
                  <div className="flex items-center">
                    <Button size="icon-xs" variant="ghost" onClick={handleStartEditPreset}>
                      <PencilIcon />
                    </Button>
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      onClick={() => deletePresetMutation.mutate(selectedPresetName)}
                      disabled={deletePresetMutation.isPending}
                      className="hover:text-destructive"
                    >
                      <Trash2Icon />
                    </Button>
                  </div>
                )}
                {isEditingPreset && (
                  <div className="flex items-center">
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      onClick={handleSavePresetMetadata}
                      disabled={
                        savePresetMutation.isPending ||
                        !editPresetName.startsWith("ig/") ||
                        editPresetName.length < 4
                      }
                    >
                      <CheckIcon />
                    </Button>
                    <Button size="icon-xs" variant="ghost" onClick={handleCancelEditPreset}>
                      <XIcon />
                    </Button>
                  </div>
                )}
              </div>

              {/* Preset name */}
              {isEditingPreset ? (
                <Input
                  value={editPresetName}
                  onChange={(e) => setEditPresetName(e.target.value)}
                  placeholder="ig/preset-name"
                  className="h-7 text-xs font-mono mb-2"
                />
              ) : (
                <p className="text-sm font-mono truncate mb-1">
                  {selectedPresetName ??
                    selectedModelEntry?.displayName ??
                    formatFalEndpointId(model)}
                </p>
              )}

              {/* Preset description */}
              {isEditingPreset ? (
                <textarea
                  value={editPresetDescription}
                  onChange={(e) => setEditPresetDescription(e.target.value)}
                  placeholder="description (optional)"
                  className="w-full h-14 text-xs p-2 bg-transparent border border-border resize-none mb-2"
                />
              ) : selectedPreset?.description ? (
                <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                  {selectedPreset.description}
                </p>
              ) : null}

              {/* Modified indicator and actions */}
              {selectedPresetName && !isEditingPreset && (
                <>
                  {isModified && (
                    <span className="inline-block text-[10px] px-1.5 py-0.5 bg-amber-500/20 text-amber-500 mb-2">
                      modified
                    </span>
                  )}
                  {isModified && (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleUpdatePreset}
                        disabled={savePresetMutation.isPending}
                        className="flex-1 h-7 text-xs"
                      >
                        {savePresetMutation.isPending ? "saving..." : "update"}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleOpenSaveDialog}
                        className="flex-1 h-7 text-xs"
                      >
                        save as new
                      </Button>
                    </div>
                  )}
                </>
              )}

              {/* Save as preset when no preset selected */}
              {!selectedPresetName && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleOpenSaveDialog}
                  disabled={!model.trim()}
                  className="w-full mt-2"
                >
                  <SaveIcon data-icon="inline-start" />
                  save as preset
                </Button>
              )}
            </div>

            {/* Slug */}
            <div className="p-4 border-b border-border">
              <h3 className="text-xs text-muted-foreground mb-2">slug</h3>
              <Input
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-/]/g, ""))}
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

      {/* Save preset dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-mono text-base">save preset</DialogTitle>
            <DialogDescription>Save current configuration as a reusable preset.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">name</label>
              <Input
                value={presetNameInput}
                onChange={(e) => setPresetNameInput(e.target.value)}
                placeholder="ig/my-preset"
                className="h-8 text-sm font-mono mt-1"
              />
              {!presetNameInput.startsWith("ig/") && presetNameInput.length > 0 && (
                <p className="text-[10px] text-destructive mt-1">Name must start with "ig/"</p>
              )}
            </div>
            <div>
              <label className="text-xs text-muted-foreground">description</label>
              <Input
                value={presetDescriptionInput}
                onChange={(e) => setPresetDescriptionInput(e.target.value)}
                placeholder="optional notes"
                className="h-8 text-sm mt-1"
              />
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              <p>
                model: <span className="font-mono">{model}</span>
              </p>
              {tags.length > 0 && <p>tags: {tags.join(", ")}</p>}
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowSaveDialog(false)}>
              cancel
            </Button>
            <Button
              size="sm"
              onClick={() => savePresetMutation.mutate(presetNameInput)}
              disabled={
                savePresetMutation.isPending ||
                !presetNameInput.startsWith("ig/") ||
                presetNameInput.length < 4
              }
            >
              {savePresetMutation.isPending ? "saving..." : "save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
