import type { discordBot } from '@ig/infra/alchemy.run'
import { isChatInputApplicationCommandInteraction } from 'discord-api-types/utils/v10'
import { InteractionType, type APIInteraction } from 'discord-api-types/v10'
import { Hono } from 'hono'

import { createContext } from '../context'
import { createDiscordClient } from '../discord'
import { verifyDiscordWebhook } from '../webhook'
import { runImagine } from './imagine'

export const interactions = new Hono<{ Bindings: typeof discordBot.Env }>()
  .onError((error, c) => {
    console.error(error)
    const discord = createDiscordClient(c.env)
    const message = error instanceof Error ? error.message : 'Something went wrong.'
    return c.json(discord.ephemeralError(message))
  })
  .post('/', async (c) => {
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
    const ctx = await createContext(c.env)

    if (interaction.type === InteractionType.Ping) {
      return c.json(ctx.discord.pong())
    }

    if (interaction.type === InteractionType.ApplicationCommand) {
      if (isChatInputApplicationCommandInteraction(interaction)) {
        if (interaction.data.name === 'imagine') {
          c.executionCtx.waitUntil(
            runImagine(ctx, interaction).catch(async (error) => {
              const token = interaction.token
              const message = error instanceof Error ? error.message : 'Something went wrong.'
              console.error('[discord-bot:imagine] generation failed', { error })
              await ctx.discord.editOriginalInteractionResponse(token, { content: message })
            }),
          )

          return c.json(ctx.discord.defer())
        }
      }
    }

    return c.json(ctx.discord.defer())
  })
