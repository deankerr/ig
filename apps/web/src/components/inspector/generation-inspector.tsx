import { useMutation, useQuery } from '@tanstack/react-query'
import { BracesIcon, SendIcon, TrashIcon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { HeaderAction } from '@/components/inspector/header-action'
import { useInspector } from '@/components/inspector/inspector-context'
import {
  InspectorBody,
  InspectorContent,
  InspectorHeader,
  InspectorSidebar,
} from '@/components/inspector/inspector-layout'
import { MetaField } from '@/components/inspector/meta-field'
import { ArtifactLink } from '@/components/shared/artifact-link'
import { useJsonSheet } from '@/components/shared/json-sheet'
import { TimeAgo } from '@/components/shared/time-ago'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { orpc, queryClient } from '@/lib/api'
import { formatDuration } from '@/lib/format'
import { deleteGenerationMutation, getGenerationOptions, statusQueryOptions } from '@/lib/queries'

export function GenerationInspector() {
  const { id, close, sendToBench } = useInspector()
  const query = useQuery(getGenerationOptions(id))
  const deleteMutation = useMutation(deleteGenerationMutation())
  const jsonSheet = useJsonSheet()
  const [deleteOpen, setDeleteOpen] = useState(false)

  if (query.isLoading) {
    return <div className="text-muted-foreground py-8 text-center text-xs">Loading...</div>
  }

  if (!query.data) {
    return (
      <div className="text-muted-foreground py-8 text-center text-xs">Generation not found</div>
    )
  }

  const { artifacts, ...generation } = query.data
  const duration = generation.completedAt
    ? new Date(generation.completedAt).getTime() - new Date(generation.createdAt).getTime()
    : null

  async function handleViewRequestState() {
    const data = await queryClient.fetchQuery(statusQueryOptions(generation.id))
    jsonSheet.open(data ?? 'No DO state found', `request/${generation.id}`)
  }

  function handleDelete() {
    deleteMutation.mutate(
      { id },
      {
        onSuccess: () => {
          console.log('[generation-inspector:deleted]', { id })
          toast.success('Generation deleted')
          queryClient.invalidateQueries({ queryKey: orpc.browse.key() })
          close()
        },
        onError: (error) => {
          toast.error(`Delete failed: ${error.message}`)
        },
      },
    )
  }

  return (
    <>
      <InspectorHeader title={`generation/${generation.id}`}>
        <HeaderAction label="Send to bench" onClick={() => sendToBench(generation.input)}>
          <SendIcon />
        </HeaderAction>
        <HeaderAction
          label="JSON"
          onClick={() => jsonSheet.open({ generation, artifacts }, `generation/${generation.id}`)}
        >
          <BracesIcon />
        </HeaderAction>
        <HeaderAction label="Delete" onClick={() => setDeleteOpen(true)}>
          <TrashIcon />
        </HeaderAction>
      </InspectorHeader>

      <InspectorBody>
        {/* Artifact grid */}
        <InspectorContent className="p-4">
          {artifacts.length > 0 ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-2">
              {artifacts.map((a) => (
                <ArtifactLink key={a.id} id={a.id} mode="grid" />
              ))}
            </div>
          ) : (
            <div className="text-muted-foreground py-8 text-center text-xs">No artifacts</div>
          )}
        </InspectorContent>

        {/* Metadata sidebar */}
        <InspectorSidebar>
          <MetaField label="model" value={generation.model} />
          <MetaField label="artifacts" value={`${artifacts.length} / ${generation.batch}`} />
          <MetaField
            label="duration"
            value={duration != null ? formatDuration(duration) : 'in progress'}
          />
          <MetaField label="created" value={<TimeAgo date={generation.createdAt} />} />
          {generation.error && <MetaField label="error" value={generation.error} />}

          {/* Generation input */}
          <div className="mt-1 flex flex-col gap-1">
            <span className="text-muted-foreground text-xs font-medium">input</span>
            <pre className="bg-muted h-72 overflow-auto p-2 text-xs break-all whitespace-pre-wrap">
              {JSON.stringify(generation.input, null, 2)}
            </pre>
          </div>

          {/* Link to DO request state */}
          <div className="mt-1">
            <Button
              variant="link"
              size="sm"
              className="text-foreground underline decoration-dotted"
              onClick={handleViewRequestState}
            >
              view DO request state
            </Button>
          </div>
        </InspectorSidebar>
      </InspectorBody>

      {/* Delete confirmation */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Delete generation</DialogTitle>
            <DialogDescription>
              This will permanently delete the generation, {artifacts.length} artifact
              {artifacts.length !== 1 ? 's' : ''}, and all associated R2 objects. This cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
