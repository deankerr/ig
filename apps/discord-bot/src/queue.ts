import type { GenerationLifecycleEvent } from '@ig/server'

import type { BotContext } from './context'
import { handleImagineEvent } from './interactions/imagine/events'

export async function handleGenerationEvent(ctx: BotContext, event: GenerationLifecycleEvent) {
  if (event.tags['discord-bot:command'] === 'imagine') {
    await handleImagineEvent(ctx, event)
  }
}
