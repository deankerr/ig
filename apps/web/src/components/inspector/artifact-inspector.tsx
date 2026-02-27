import { Link, useSearch } from '@tanstack/react-router'
import {
  BracesIcon,
  ClipboardIcon,
  DownloadIcon,
  ExternalLinkIcon,
  ImageOffIcon,
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
import { Loader } from '@/components/loader'
import { ArtifactMedia } from '@/components/shared/artifact-media'
import { useJsonSheet } from '@/components/shared/json-sheet'
import { TimeAgo } from '@/components/shared/time-ago'
import { Button } from '@/components/ui/button'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty'
import { queryClient } from '@/lib/api'
import { formatDuration, formatPrice, formatPrompt } from '@/lib/format'
import { statusQueryOptions, useArtifact, useDeleteArtifact } from '@/lib/queries'
import { cn, serverUrl } from '@/lib/utils'

import { ModelField } from '../shared/model-field'

export function ArtifactInspector() {
  const { id, close, copy, sendToBench } = useInspector()
  const search = useSearch({ from: '/' })
  const query = useArtifact(id)
  const deleteMutation = useDeleteArtifact()
  const jsonSheet = useJsonSheet()

  if (query.isLoading) {
    return (
      <>
        <InspectorHeader title={`artifact/${id}`} />
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
        <InspectorHeader title={`artifact/${id}`} />
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ImageOffIcon />
            </EmptyMedia>
            <EmptyTitle>Artifact not found</EmptyTitle>
            <EmptyDescription>This artifact may have been deleted.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </>
    )
  }

  const { artifact, generation, siblings } = query.data
  const source = artifact.tags['ig:source'] as string | undefined
  const imageUrl = `${serverUrl.origin}/artifacts/${artifact.id}/file`
  const slug = artifact.tags['ig:slug'] as string | undefined
  const publicUrl = slug ? `${serverUrl.origin}/a/${slug}` : imageUrl
  const prompt = generation ? formatPrompt(generation.input) : null
  const duration = generation?.completedAt
    ? new Date(generation.completedAt).getTime() - new Date(generation.createdAt).getTime()
    : null

  function handleDownload() {
    const a = document.createElement('a')
    a.href = imageUrl
    a.download = `${artifact.id}.${artifact.contentType.split('/')[1] ?? 'bin'}`
    a.click()
  }

  function handleDelete() {
    deleteMutation.mutate(
      { id },
      {
        onSuccess: () => {
          console.log('[artifact-inspector:deleted]', { id })
          toast.success('Artifact deleted')
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
        <HeaderAction label="Open in new tab" onClick={() => window.open(publicUrl, '_blank')}>
          <ExternalLinkIcon />
        </HeaderAction>
        <HeaderAction label="Download" onClick={handleDownload}>
          <DownloadIcon />
        </HeaderAction>
        <HeaderAction
          label={slug ? 'Copy slug URL' : 'Copy URL'}
          onClick={() => copy(publicUrl, 'URL copied')}
        >
          <ClipboardIcon />
        </HeaderAction>
        {generation && (
          <HeaderAction label="Send to bench" onClick={() => sendToBench(generation.input)}>
            <SendIcon />
          </HeaderAction>
        )}
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
          <ArtifactMedia
            id={artifact.id}
            contentType={artifact.contentType}
            width={2048}
            fit="contain"
            className="flex-1"
          />
          {siblings.length > 1 && (
            <div className="flex shrink-0 justify-center gap-1 border-t p-2">
              {siblings.map((s) => (
                <Link
                  key={s.id}
                  to="/"
                  search={{ ...search, artifact: s.id }}
                  className={cn(
                    'border transition-colors',
                    s.id === artifact.id
                      ? 'border-ring'
                      : 'hover:border-ring/50 border-transparent',
                  )}
                >
                  <ArtifactMedia
                    id={s.id}
                    contentType={s.contentType}
                    width={256}
                    className="size-20"
                  />
                </Link>
              ))}
            </div>
          )}
        </InspectorContent>

        {/* Metadata sidebar */}
        <InspectorSidebar>
          {prompt && (
            <div className="flex flex-col gap-0.5 text-xs">
              <span className="text-muted-foreground">prompt</span>
              <span className="break-words">{prompt}</span>
            </div>
          )}
          <ModelField air={artifact.model} />
          <MetaField label="content type" value={artifact.contentType} />
          {artifact.width != null && artifact.height != null && (
            <MetaField label="dimensions" value={`${artifact.width} × ${artifact.height}`} />
          )}
          {artifact.seed != null && <MetaField label="seed" value={String(artifact.seed)} />}
          {artifact.cost != null && <MetaField label="cost" value={formatPrice(artifact.cost)} />}
          {duration != null && <MetaField label="duration" value={formatDuration(duration)} />}
          <MetaField label="created" value={<TimeAgo date={artifact.createdAt} />} />

          {/* Source provenance (ingested/generated artifacts) */}
          {source && (
            <div className="flex flex-col gap-0.5 text-xs">
              <span className="text-muted-foreground">source</span>
              {source.startsWith('http') ? (
                <a
                  href={source}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="break-all underline decoration-dotted"
                >
                  {source}
                </a>
              ) : (
                <span className="break-all">{source}</span>
              )}
            </div>
          )}

          {/* Tags */}
          {Object.keys(artifact.tags).length > 0 && (
            <div className="mt-1 flex flex-col gap-1">
              <span className="text-muted-foreground text-xs font-medium">tags</span>
              <div className="flex flex-wrap gap-1">
                {Object.entries(artifact.tags).map(([key, value]) => (
                  <span key={key} className="bg-muted rounded px-1.5 py-0.5 text-xs break-all">
                    {value != null ? `${key}=${value}` : key}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Generation details (only for inference-created artifacts) */}
          {generation && (
            <>
              <div className="mt-1 flex flex-col gap-1">
                <span className="text-muted-foreground text-xs font-medium">generation input</span>
                <pre className="bg-muted h-72 overflow-auto p-2 text-xs break-all whitespace-pre-wrap">
                  {JSON.stringify(generation.input, null, 2)}
                </pre>
              </div>

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
                  onClick={async () => {
                    const data = await queryClient.fetchQuery(statusQueryOptions(generation.id))
                    jsonSheet.open(data ?? 'No DO state found', `request/${generation.id}`)
                  }}
                >
                  view DO request state
                </Button>
              </div>
            </>
          )}
        </InspectorSidebar>
      </InspectorBody>
    </>
  )
}
