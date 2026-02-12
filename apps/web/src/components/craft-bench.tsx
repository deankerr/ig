import { useMutation, useQuery } from '@tanstack/react-query'
import { SendIcon, XIcon } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import { useBench } from '@/components/bench-provider'
import { ArtifactLink } from '@/components/shared/artifact-link'
import { PulsingDot } from '@/components/shared/pulsing-dot'
import { Button } from '@/components/ui/button'
import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from '@/components/ui/item'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { orpc, queryClient } from '@/lib/orpc'
import * as storage from '@/lib/storage'
import { createImageMutation, statusQueryOptions } from '@/queries/inference'

const CRAFT_BENCH_EVENT = 'craft-bench-input-update'

const DEFAULT_INPUT = JSON.stringify({ model: '', positivePrompt: '' }, null, 2)

// Fields accepted by the imageInferenceInput schema
const INPUT_KEYS = new Set([
  'model',
  'positivePrompt',
  'negativePrompt',
  'width',
  'height',
  'steps',
  'scheduler',
  'seed',
  'CFGScale',
  'clipSkip',
  'strength',
  'seedImage',
  'maskImage',
  'outputFormat',
  'checkNSFW',
  'promptWeighting',
  'lora',
  'numberResults',
])

// Extract only valid inference input fields from a generation's stored input
function extractInputFields(raw: Record<string, unknown>) {
  const result: Record<string, unknown> = {}
  for (const key of Object.keys(raw)) {
    if (INPUT_KEYS.has(key)) result[key] = raw[key]
  }
  return result
}

// Module-level function for external callers (e.g., detail modal "Send to Bench")
export function setCraftBenchInput(input: Record<string, unknown>) {
  const cleaned = extractInputFields(input)
  storage.setBenchInput(JSON.stringify(cleaned, null, 2))
  window.dispatchEvent(new CustomEvent(CRAFT_BENCH_EVENT))
}

export function CraftBench() {
  const { close, inflightIds, addInflight } = useBench()
  const [input, setInput] = useState(() => storage.getBenchInput() || DEFAULT_INPUT)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Persist input to localStorage (debounced)
  useEffect(() => {
    const timer = setTimeout(() => storage.setBenchInput(input), 500)
    return () => clearTimeout(timer)
  }, [input])

  // Listen for external input updates (e.g., "Send to Bench")
  useEffect(() => {
    function handleUpdate() {
      setInput(storage.getBenchInput() || DEFAULT_INPUT)
    }
    window.addEventListener(CRAFT_BENCH_EVENT, handleUpdate)
    return () => window.removeEventListener(CRAFT_BENCH_EVENT, handleUpdate)
  }, [])

  const mutation = useMutation(createImageMutation())

  const handleSend = useCallback(() => {
    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(input)
    } catch {
      toast.error('Invalid JSON input')
      return
    }

    console.log('[craft-bench:send]', { input: parsed })

    mutation.mutate(
      { input: parsed as never },
      {
        onSuccess: (data) => {
          console.log('[craft-bench:submitted]', { id: data.id })
          addInflight(data.id)
          toast.success('Request submitted')
        },
        onError: (error) => {
          toast.error(`Failed: ${error.message}`)
        },
      },
    )
  }, [input, mutation, addInflight])

  return (
    <div className="bg-background flex h-full flex-col">
      {/* Header */}
      <div className="border-border flex h-10 shrink-0 items-center gap-2 border-b px-3">
        <span className="text-xs font-medium">craft bench</span>
        <div className="flex-1" />
        <Tooltip>
          <TooltipTrigger render={<Button size="icon-xs" variant="ghost" onClick={close} />}>
            <XIcon />
          </TooltipTrigger>
          <TooltipContent>Close</TooltipContent>
        </Tooltip>
      </div>

      {/* Input area */}
      <div className="flex flex-col gap-2 p-3">
        <Textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder='{"positivePrompt": "..."}'
          className="min-h-24 font-mono text-xs"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault()
              handleSend()
            }
          }}
        />
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-xs">cmd+enter to send</span>
          <Button size="sm" onClick={handleSend} disabled={mutation.isPending || !input.trim()}>
            <SendIcon data-icon="inline-start" />
            send
          </Button>
        </div>
      </div>

      {/* In-flight generations */}
      {inflightIds.length > 0 && (
        <div className="border-border flex-1 overflow-y-auto border-t">
          <div className="p-3">
            <span className="text-muted-foreground text-xs">in-flight</span>
          </div>
          {inflightIds.map((id) => (
            <InflightGeneration key={id} id={id} />
          ))}
        </div>
      )}
    </div>
  )
}

// Tracks a single in-flight generation with status polling
function InflightGeneration({ id }: { id: string }) {
  const query = useQuery(statusQueryOptions(id))
  const data = query.data

  // Invalidate browse queries when generation completes
  useEffect(() => {
    if (data?.completedAt) {
      void queryClient.invalidateQueries({ queryKey: orpc.browse.key() })
    }
  }, [data?.completedAt])

  const isComplete = !!data?.completedAt
  // Filter outputs for successful artifacts
  const artifacts = (data?.outputs ?? []).filter((o) => o.type === 'success')

  return (
    <div className="border-border border-b px-3 py-2">
      <Item size="xs">
        <ItemMedia variant="icon">
          {!isComplete ? (
            <PulsingDot color="pending" />
          ) : (
            <span className="text-status-ready">●</span>
          )}
        </ItemMedia>
        <ItemContent>
          <ItemTitle className="font-mono">{id}</ItemTitle>
          {isComplete && (
            <ItemDescription>
              {artifacts.length} artifact{artifacts.length !== 1 ? 's' : ''}
            </ItemDescription>
          )}
        </ItemContent>
      </Item>

      {/* Completed artifact thumbnails */}
      {artifacts.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {artifacts.map((a) => {
            if (a.type !== 'success') return null
            return <ArtifactLink key={a.id} id={a.id} />
          })}
        </div>
      )}
    </div>
  )
}
