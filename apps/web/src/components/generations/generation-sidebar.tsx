import { useMutation } from "@tanstack/react-query"
import { Trash2Icon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { Copyable } from "@/components/copyable"
import { Field } from "@/components/field"
import { DeleteGenerationDialog } from "@/components/generations/delete-generation-dialog"
import { Tag } from "@/components/tag"
import { TagInput } from "@/components/tag-input"
import { TimeAgo } from "@/components/time-ago"
import { Button } from "@/components/ui/button"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
import { formatDuration, normalizeSlug } from "@/lib/format"
import { formatFalEndpointId } from "@/lib/format-endpoint"
import { updateGenerationOptions, invalidateGeneration } from "@/queries/generations"
import type { Generation } from "@/types"

export function GenerationSidebar({
  generation,
  generationId,
  onClose,
}: {
  generation: Generation
  generationId: string
  onClose: () => void
}) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [editingSlug, setEditingSlug] = useState(false)
  const [slugInput, setSlugInput] = useState("")

  const updateMutation = useMutation({
    ...updateGenerationOptions(),
    onSuccess: () => {
      invalidateGeneration(generationId)
      setEditingSlug(false)
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update")
    },
  })

  const prompt = typeof generation.input.prompt === "string" ? generation.input.prompt : null

  const completionTime =
    generation.completedAt && generation.createdAt
      ? formatDuration(generation.createdAt, generation.completedAt)
      : null

  function handleRemoveTag(tag: string) {
    updateMutation.mutate({ id: generationId, remove: [tag] })
  }

  return (
    <>
      <aside className="w-80 border-l border-border bg-card overflow-y-auto shrink-0">
        <div className="divide-y divide-border">
          {/* Actions */}
          <div className="p-4 flex items-center gap-2">
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
                    onChange={(e) => setSlugInput(normalizeSlug(e.target.value))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        updateMutation.mutate({ id: generationId, slug: slugInput })
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
                      onClick={() => updateMutation.mutate({ id: generationId, slug: slugInput })}
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
            <Field label="model">
              <Copyable text={generation.model} className="text-sm block">
                {formatFalEndpointId(generation.model)}
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
              {generation.tags.map((tag: string) => (
                <Tag key={tag} onRemove={() => handleRemoveTag(tag)}>
                  {tag}
                </Tag>
              ))}
            </div>
            <TagInput
              onAdd={(tag) => {
                if (!generation.tags.includes(tag)) {
                  updateMutation.mutate({ id: generationId, add: [tag] })
                }
              }}
            />
          </div>
        </div>
      </aside>

      <DeleteGenerationDialog
        generationId={generationId}
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        onDeleted={onClose}
      />
    </>
  )
}
