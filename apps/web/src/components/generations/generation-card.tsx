import { useMutation } from '@tanstack/react-query'
import { BracesIcon, MoreHorizontalIcon, RefreshCwIcon, Trash2Icon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { DeleteGenerationDialog } from '@/components/generations/delete-generation-dialog'
import { Tag } from '@/components/tag'
import { Thumbnail, THUMBNAIL_SIZE } from '@/components/thumbnail'
import { TimeAgo } from '@/components/time-ago'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { formatDuration } from '@/lib/format'
import { formatFalEndpointId } from '@/lib/format-endpoint'
import { regenerateGenerationOptions, invalidateGenerations } from '@/queries/generations'
import type { Generation } from '@/types'

function getPrompt(input: Record<string, unknown>): string | null {
  if (typeof input.prompt === 'string') return input.prompt
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

  const regenerateMutation = useMutation({
    ...regenerateGenerationOptions(),
    onSuccess: () => {
      invalidateGenerations()
      toast.success('Regeneration submitted')
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to regenerate')
    },
  })

  const cardClassName =
    'group border border-border bg-card hover:border-muted-foreground/50 transition-colors block cursor-pointer'

  const cardContent = (
    <>
      <div className="bg-muted aspect-square overflow-hidden">
        <Thumbnail
          generationId={generation.id}
          contentType={generation.contentType}
          status={generation.status}
          className="h-full w-full"
        />
      </div>

      <div className="border-border space-y-1.5 border-t p-2">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground truncate font-mono text-xs">
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
              {generation.status === 'failed' && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.preventDefault()
                    regenerateMutation.mutate({ id: generation.id })
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
          <p className="text-muted-foreground line-clamp-2 text-xs leading-relaxed">{prompt}</p>
        )}

        <div className="text-muted-foreground flex items-center gap-2 text-[10px]">
          <span className="max-w-[120px] truncate">{formatFalEndpointId(generation.model)}</span>
          <span>·</span>
          <TimeAgo date={new Date(generation.createdAt)} />
          {generation.completedAt && (
            <span>({formatDuration(generation.createdAt, generation.completedAt)}s)</span>
          )}
        </div>

        {generation.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {generation.tags.slice(0, 3).map((tag) => (
              <Tag key={tag} className="text-[10px]">
                {tag}
              </Tag>
            ))}
            {generation.tags.length > 3 && (
              <span className="text-muted-foreground text-[10px]">
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
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onSelect(generation.id)
                }
              }
            : undefined
        }
        role={onSelect ? 'button' : undefined}
        tabIndex={onSelect ? 0 : undefined}
      >
        {cardContent}
      </div>

      <DeleteGenerationDialog
        generationId={generation.id}
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
      />
    </>
  )
}
