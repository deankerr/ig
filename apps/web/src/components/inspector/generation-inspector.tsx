import { Link, useSearch } from '@tanstack/react-router'
import { BracesIcon, FileSearchIcon, SendIcon, TrashIcon } from 'lucide-react'
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
import { Loader } from '@/components/loader'
import { ArtifactMedia } from '@/components/shared/artifact-media'
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
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty'
import { queryClient } from '@/lib/api'
import { formatDuration, formatPrice, formatPrompt } from '@/lib/format'
import { statusQueryOptions, useDeleteGeneration, useGeneration } from '@/lib/queries'

import { ModelField } from '../shared/model-field'

export function GenerationInspector() {
  const { id, close, sendToBench } = useInspector()
  const search = useSearch({ from: '/' })
  const query = useGeneration(id)
  const deleteMutation = useDeleteGeneration()
  const jsonSheet = useJsonSheet()
  const [deleteOpen, setDeleteOpen] = useState(false)

  if (query.isLoading) {
    return (
      <>
        <InspectorHeader title={`generation/${id}`} />
        <InspectorBody>
          <InspectorContent>
            <Loader />
          </InspectorContent>
          <InspectorSidebar>{null}</InspectorSidebar>
        </InspectorBody>
      </>
    )
  }

  if (!query.data) {
    return (
      <>
        <InspectorHeader title={`generation/${id}`} />
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FileSearchIcon />
            </EmptyMedia>
            <EmptyTitle>Generation not found</EmptyTitle>
            <EmptyDescription>This generation may have been deleted.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </>
    )
  }

  const { artifacts, ...generation } = query.data
  const prompt = formatPrompt(generation.input)
  const totalCost = artifacts.reduce((sum, a) => sum + (a.cost ?? 0), 0)
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
                <Link
                  key={a.id}
                  to="/"
                  search={{ ...search, artifact: a.id }}
                  className="hover:border-ring relative aspect-square overflow-hidden border border-transparent transition-colors"
                >
                  <ArtifactMedia
                    id={a.id}
                    contentType={a.contentType}
                    width={512}
                    className="h-full w-full"
                  />
                </Link>
              ))}
            </div>
          ) : (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>No artifacts</EmptyTitle>
                <EmptyDescription>
                  This generation hasn't produced any artifacts yet.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </InspectorContent>

        {/* Metadata sidebar */}
        <InspectorSidebar>
          {prompt !== '' && (
            <div className="flex flex-col gap-0.5 text-xs">
              <span className="text-muted-foreground">prompt</span>
              <span className="break-words">{prompt}</span>
            </div>
          )}
          <ModelField air={generation.model} />
          <MetaField label="artifacts" value={`${artifacts.length} / ${generation.batch}`} />
          {totalCost > 0 && <MetaField label="total cost" value={formatPrice(totalCost)} />}
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
