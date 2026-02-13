import { useMutation, useQuery } from '@tanstack/react-query'
import {
  BracesIcon,
  ClipboardIcon,
  DownloadIcon,
  ExternalLinkIcon,
  SendIcon,
  TrashIcon,
} from 'lucide-react'
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
import { orpc, queryClient } from '@/lib/api'
import { formatDuration, formatPrice } from '@/lib/format'
import { deleteArtifactMutation, getArtifactOptions, statusQueryOptions } from '@/lib/queries'
import { serverUrl } from '@/lib/utils'

export function ArtifactInspector() {
  const { id, close, copy, sendToBench } = useInspector()
  const query = useQuery(getArtifactOptions(id))
  const deleteMutation = useMutation(deleteArtifactMutation())
  const jsonSheet = useJsonSheet()

  if (query.isLoading) {
    return <div className="text-muted-foreground py-8 text-center text-xs">Loading...</div>
  }

  if (!query.data) {
    return <div className="text-muted-foreground py-8 text-center text-xs">Artifact not found</div>
  }

  const { artifact, generation, siblings } = query.data
  const imageUrl = `${serverUrl.origin}/artifacts/${artifact.id}/file`
  const duration = generation.completedAt
    ? new Date(generation.completedAt).getTime() - new Date(generation.createdAt).getTime()
    : null

  function handleDownload() {
    const a = document.createElement('a')
    a.href = imageUrl
    a.download = `${artifact.id}.${artifact.contentType.split('/')[1] ?? 'bin'}`
    a.click()
  }

  function handleSendToBench() {
    sendToBench(generation.input)
  }

  async function handleViewRequestState() {
    const data = await queryClient.fetchQuery(statusQueryOptions(generation.id))
    jsonSheet.open(data ?? 'No DO state found', `request/${generation.id}`)
  }

  function handleDelete() {
    deleteMutation.mutate(
      { id },
      {
        onSuccess: () => {
          console.log('[artifact-inspector:deleted]', { id })
          toast.success('Artifact deleted')
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
      <InspectorHeader title={`artifact/${artifact.id}`}>
        <HeaderAction label="Open in new tab" onClick={() => window.open(imageUrl, '_blank')}>
          <ExternalLinkIcon />
        </HeaderAction>
        <HeaderAction label="Download" onClick={handleDownload}>
          <DownloadIcon />
        </HeaderAction>
        <HeaderAction label="Copy URL" onClick={() => copy(imageUrl, 'URL copied')}>
          <ClipboardIcon />
        </HeaderAction>
        <HeaderAction label="Send to bench" onClick={handleSendToBench}>
          <SendIcon />
        </HeaderAction>
        <HeaderAction
          label="JSON"
          onClick={() => jsonSheet.open(artifact, `artifact/${artifact.id}`)}
        >
          <BracesIcon />
        </HeaderAction>
        <HeaderAction label="Delete" onClick={handleDelete}>
          <TrashIcon />
        </HeaderAction>
      </InspectorHeader>

      <InspectorBody>
        {/* Image preview + sibling strip */}
        <InspectorContent className="flex flex-col">
          <div className="bg-muted flex flex-1 items-center justify-center overflow-hidden">
            <img
              src={`${imageUrl}?w=1024&f=webp`}
              alt=""
              className="max-h-full max-w-full object-contain"
            />
          </div>
          {siblings.length > 1 && (
            <div className="flex shrink-0 justify-center gap-1 border-t p-2">
              {siblings.map((s) => (
                <ArtifactLink key={s.id} id={s.id} active={s.id === artifact.id} />
              ))}
            </div>
          )}
        </InspectorContent>

        {/* Metadata sidebar */}
        <InspectorSidebar>
          <MetaField label="model" value={artifact.model} />
          <MetaField label="content type" value={artifact.contentType} />
          {artifact.seed != null && <MetaField label="seed" value={String(artifact.seed)} />}
          {artifact.cost != null && <MetaField label="cost" value={formatPrice(artifact.cost)} />}
          <MetaField
            label="duration"
            value={duration != null ? formatDuration(duration) : 'in progress'}
          />
          <MetaField label="created" value={<TimeAgo date={artifact.createdAt} />} />

          {/* Tags */}
          {Object.keys(artifact.tags).length > 0 && (
            <div className="mt-1 flex flex-col gap-1">
              <span className="text-muted-foreground text-xs font-medium">tags</span>
              <div className="flex flex-wrap gap-1">
                {Object.entries(artifact.tags).map(([key, value]) => (
                  <span key={key} className="bg-muted rounded px-1.5 py-0.5 text-xs">
                    {value != null ? `${key}=${value}` : key}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Generation input */}
          <div className="mt-1 flex flex-col gap-1">
            <span className="text-muted-foreground text-xs font-medium">generation input</span>
            <pre className="bg-muted h-72 overflow-auto p-2 text-xs break-all whitespace-pre-wrap">
              {JSON.stringify(generation.input, null, 2)}
            </pre>
          </div>

          {/* Links to related records */}
          <div className="mt-1 flex flex-col items-start gap-1">
            <Button
              variant="link"
              size="sm"
              className="text-foreground underline decoration-dotted"
              onClick={() => jsonSheet.open(generation, `generation/${generation.id}`)}
            >
              view generation record
            </Button>
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
    </>
  )
}
