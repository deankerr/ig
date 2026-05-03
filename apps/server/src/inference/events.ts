import { env } from '@ig/env/server'
import { v7 as uuidv7 } from 'uuid'

import type { OutputSuccess } from './result'

export type GenerationLifecycleEvent = {
  version: 1
  id: string
  type:
    | 'generation.submitted'
    | 'generation.dispatched'
    | 'artifact.created'
    | 'generation.completed'
    | 'generation.failed'
  generationId: string
  occurredAt: string
  model: string
  input: Record<string, unknown>
  tags: Record<string, string | null>
  artifact?: ArtifactEventSummary
  artifacts?: ArtifactEventSummary[]
  error?: string
}

export type ArtifactEventSummary = {
  id: string
  seed: number | null
  contentType: string
}

type PublishArgs = Omit<GenerationLifecycleEvent, 'version' | 'id' | 'occurredAt'>

export function summarizeArtifact(artifact: OutputSuccess): ArtifactEventSummary {
  return {
    id: artifact.id,
    seed: artifact.seed ?? null,
    contentType: artifact.contentType,
  }
}

export async function publishGenerationEvent(
  args: PublishArgs,
  queue: Queue<unknown> = env.GENERATION_EVENTS,
) {
  const event: GenerationLifecycleEvent = {
    version: 1,
    id: uuidv7(),
    occurredAt: new Date().toISOString(),
    ...args,
  }

  try {
    await (queue as Queue<GenerationLifecycleEvent>).send(event, {
      contentType: 'json',
    })
    console.log('[inference:event]', { type: event.type, generationId: event.generationId })
  } catch (error) {
    console.error('[inference:event] publish failed', {
      type: event.type,
      generationId: event.generationId,
      error,
    })
  }
}
