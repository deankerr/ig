import { isChatInputApplicationCommandInteraction } from 'discord-api-types/utils/v10'
import {
  InteractionType,
  type APIApplicationCommandAutocompleteInteraction,
  type APIChatInputApplicationCommandInteraction,
  type APIInteraction,
} from 'discord-api-types/v10'
import type { Context as HonoContext } from 'hono'

import {
  autocomplete,
  deferPublic,
  editOriginalInteractionResponse,
  pong,
  verifyDiscordRequest,
} from './discord-api'
import { createIgClient } from './ig'
import { handleImagineAutocomplete, runImagine } from './imagine'

function ensureConfiguredGuild(env: Env, interaction: APIInteraction) {
  if (!interaction.guild_id || interaction.guild_id !== env.DISCORD_GUILD_ID) {
    throw new Error('This bot only accepts interactions from the configured guild')
  }
}

async function parseVerifiedInteraction(
  c: HonoContext<{ Bindings: Env }>,
  rawBody: string,
): Promise<APIInteraction | null> {
  const signatureIsValid = await verifyDiscordRequest(
    rawBody,
    c.req.header('X-Signature-Ed25519'),
    c.req.header('X-Signature-Timestamp'),
    c.env.DISCORD_PUBLIC_KEY,
  )

  if (!signatureIsValid) {
    return null
  }

  return JSON.parse(rawBody) as APIInteraction
}

export async function handleInteraction(c: HonoContext<{ Bindings: Env }>) {
  const rawBody = await c.req.text()
  const interaction = await parseVerifiedInteraction(c, rawBody)

  if (!interaction) {
    return c.text('invalid request signature', 401)
  }

  if (interaction.type === InteractionType.Ping) {
    return c.json(pong())
  }

  ensureConfiguredGuild(c.env, interaction)

  const ig = createIgClient(c.env)

  console.log({ interaction })

  if (interaction.type === InteractionType.ApplicationCommandAutocomplete) {
    const choices =
      interaction.data.name === 'imagine'
        ? await handleImagineAutocomplete(
            {
              env: c.env,
              searchModels: ig.searchModels.bind(ig),
            },
            interaction as APIApplicationCommandAutocompleteInteraction,
          )
        : []

    return c.json(autocomplete(choices))
  }

  if (interaction.type === InteractionType.ApplicationCommand) {
    if (isChatInputApplicationCommandInteraction(interaction)) {
      const command = interaction as APIChatInputApplicationCommandInteraction

      if (command.data.name === 'imagine') {
        runImagine(
          {
            env: c.env,
            waitUntil: c.executionCtx.waitUntil.bind(c.executionCtx),
            createGeneration: ig.createGeneration.bind(ig),
            editOriginalResponse: (interactionToken, body) =>
              editOriginalInteractionResponse(c.env, interactionToken, body),
          },
          command,
        )

        return c.json(deferPublic())
      }
    }
  }

  return c.json(deferPublic())
}
