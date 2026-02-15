import { BracesIcon, SendIcon, XIcon } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'

import { useBench } from '@/components/bench-provider'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useCreateImage } from '@/lib/queries'
import * as storage from '@/lib/storage'

const CRAFT_BENCH_EVENT = 'craft-bench-input-update'

const DEFAULT_INPUT = JSON.stringify({ model: '', positivePrompt: '' }, null, 2)

/** Try to pretty-print JSON, return as-is if invalid. */
function tryFormatJson(raw: string) {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2)
  } catch {
    return raw
  }
}

// Fields accepted by the createImage endpoint (inference + ig extensions)
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
  'tags',
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
  const { close } = useBench()
  const [input, setInput] = useState(() => tryFormatJson(storage.getBenchInput() || DEFAULT_INPUT))
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const isValidJson = useMemo(() => {
    try {
      JSON.parse(input)
      return true
    } catch {
      return false
    }
  }, [input])

  // Persist input to localStorage (debounced)
  useEffect(() => {
    const timer = setTimeout(() => storage.setBenchInput(input), 500)
    return () => clearTimeout(timer)
  }, [input])

  // Listen for external input updates (e.g., "Send to Bench")
  useEffect(() => {
    function handleUpdate() {
      setInput(tryFormatJson(storage.getBenchInput() || DEFAULT_INPUT))
    }
    window.addEventListener(CRAFT_BENCH_EVENT, handleUpdate)
    return () => window.removeEventListener(CRAFT_BENCH_EVENT, handleUpdate)
  }, [])

  const mutation = useCreateImage()

  const handleSend = useCallback(() => {
    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(input)
    } catch {
      toast.error('Invalid JSON input')
      return
    }

    // Inject source tag so artifacts from the console are identifiable
    const tags = (parsed.tags ?? {}) as Record<string, string | null>
    parsed.tags = { ...tags, source: 'ig-console' }

    console.log('[craft-bench:send]', { input: parsed })

    mutation.mutate(parsed as never, {
      onSuccess: (data) => {
        console.log('[craft-bench:submitted]', { id: data.id })
        toast.success('Request submitted')
      },
      onError: (error) => {
        toast.error(`Failed: ${error.message}`)
      },
    })
  }, [input, mutation])

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
          <div className="flex items-center gap-2">
            {!isValidJson && input.trim() ? (
              <span className="text-destructive text-xs">invalid JSON</span>
            ) : (
              <span className="text-muted-foreground text-xs">cmd+enter to send</span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    disabled={!isValidJson}
                    onClick={() => setInput(tryFormatJson(input))}
                  />
                }
              >
                <BracesIcon />
              </TooltipTrigger>
              <TooltipContent>Format JSON</TooltipContent>
            </Tooltip>
            <Button
              size="sm"
              onClick={handleSend}
              disabled={mutation.isPending || !isValidJson || !input.trim()}
            >
              <SendIcon data-icon="inline-start" />
              send
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
