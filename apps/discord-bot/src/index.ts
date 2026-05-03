import type { discordBot } from '@ig/infra/alchemy.run'
import type { GenerationLifecycleEvent } from '@ig/server'
import { isChatInputApplicationCommandInteraction } from 'discord-api-types/utils/v10'
import { InteractionType, type APIInteraction } from 'discord-api-types/v10'
import { Hono } from 'hono'

import { createContext } from './context'
import { createDiscordClient } from './discord'
import { handleImagineAutocomplete, runImagine } from './imagine'
import { handleGenerationEvent } from './queue'
import { verifyDiscordWebhook } from './webhook'

export const app = new Hono<{
  Bindings: typeof discordBot.Env
}>()
  .get('/', (c) => c.text('HELLO'))
  .onError((error, c) => {
    if (c.req.path === '/discord/interactions' && c.req.method === 'POST') {
      const discord = createDiscordClient(c.env)
      const message = error instanceof Error ? error.message : 'Something went wrong.'
      return c.json(discord.ephemeralError(message))
    }

    return c.text('internal error', 500)
  })
  .post('/discord/interactions', async (c) => {
    const rawBody = await c.req.text()

    const signatureIsValid = await verifyDiscordWebhook(
      rawBody,
      c.req.header('X-Signature-Ed25519'),
      c.req.header('X-Signature-Timestamp'),
      c.env.DISCORD_PUBLIC_KEY,
    )

    if (!signatureIsValid) {
      return c.text('invalid request signature', 401)
    }

    const interaction = JSON.parse(rawBody) as APIInteraction
    const ctx = createContext(c.env)

    if (interaction.type === InteractionType.Ping) {
      return c.json(ctx.discord.pong())
    }

    if (interaction.type === InteractionType.ApplicationCommandAutocomplete) {
      if (interaction.data.name === 'imagine') {
        const result = await handleImagineAutocomplete(ctx, interaction)

        return c.json(ctx.discord.autocomplete(result))
      }

      return c.json(ctx.discord.autocomplete([]))
    }

    if (interaction.type === InteractionType.ApplicationCommand) {
      if (isChatInputApplicationCommandInteraction(interaction)) {
        if (interaction.data.name === 'imagine') {
          await runImagine(ctx, interaction)

          return c.json(ctx.discord.defer())
        }
      }
    }

    return c.json(ctx.discord.defer())
  })

export default {
  fetch: app.fetch,
  async queue(batch: MessageBatch<GenerationLifecycleEvent>, env: typeof discordBot.Env) {
    const ctx = createContext(env)

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
