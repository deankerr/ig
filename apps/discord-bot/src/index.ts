import type { discordBot } from '@ig/infra/alchemy.run'
import { isChatInputApplicationCommandInteraction } from 'discord-api-types/utils/v10'
import { InteractionType, type APIInteraction } from 'discord-api-types/v10'
import { Hono } from 'hono'

import { createDiscordClient } from './discord'
import { createIgClient } from './ig'
import { handleImagineAutocomplete, runImagine } from './imagine'
import { createModels } from './models'
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

    const discord = createDiscordClient(c.env)

    if (interaction.type === InteractionType.Ping) {
      return c.json(discord.pong())
    }

    const ctx = {
      waitUntil: c.executionCtx.waitUntil.bind(c.executionCtx),
      env: c.env,
      ig: createIgClient({ baseUrl: c.env.IG_BASE_URL, apiKey: c.env.IG_API_KEY }),
      discord,
      models: createModels(c.env),
    }

    if (interaction.type === InteractionType.ApplicationCommandAutocomplete) {
      if (interaction.data.name === 'imagine') {
        const result = await handleImagineAutocomplete(ctx, interaction)

        return c.json(discord.autocomplete(result))
      }

      return c.json(discord.autocomplete([]))
    }

    if (interaction.type === InteractionType.ApplicationCommand) {
      if (isChatInputApplicationCommandInteraction(interaction)) {
        if (interaction.data.name === 'imagine') {
          runImagine(ctx, interaction)

          return c.json(discord.defer())
        }
      }
    }

    return c.json(discord.defer())
  })

export default {
  fetch: app.fetch,
}
