import type { discordBot } from '@ig/infra/alchemy.run'
import type { GenerationLifecycleEvent } from '@ig/server'
import { Hono } from 'hono'

import { createContext } from './context'
import { interactions } from './interactions'
import { handleGenerationEvent } from './queue'
import { web } from './web'

const app = new Hono<{ Bindings: typeof discordBot.Env }>()
  .route('/discord/interactions', interactions)
  .route('/', web)

export default {
  fetch: app.fetch,
  async queue(batch: MessageBatch<GenerationLifecycleEvent>, env: typeof discordBot.Env) {
    const ctx = await createContext(env)

    for (const message of batch.messages) {
      try {
        await handleGenerationEvent(ctx, message.body)
        message.ack()
      } catch (error) {
        console.error('[discord-bot:queue] message failed', {
          id: message.id,
          attempts: message.attempts,
          error,
        })
        message.retry({ delaySeconds: 30 })
      }
    }
  },
}
