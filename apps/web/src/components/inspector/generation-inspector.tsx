import { useQuery } from '@tanstack/react-query'
import { BracesIcon, SendIcon } from 'lucide-react'

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
import { queryClient } from '@/lib/api'
import { formatDuration } from '@/lib/format'
import { getGenerationOptions, statusQueryOptions } from '@/lib/queries'

export function GenerationInspector() {
  const { id, sendToBench } = useInspector()
  const query = useQuery(getGenerationOptions(id))
  const jsonSheet = useJsonSheet()

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
    </>
  )
}
