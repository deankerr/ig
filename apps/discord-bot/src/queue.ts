import type { GenerationLifecycleEvent } from '@ig/server'

import type { BotContext } from './context'
import { handleImagineEvent } from './imagine/events'

export async function handleGenerationEvent(ctx: BotContext, event: GenerationLifecycleEvent) {
  if (event.tags['discord:command'] === 'imagine') {
    await handleImagineEvent(ctx, event)
  }
}
