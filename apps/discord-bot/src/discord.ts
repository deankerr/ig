import type { discordBot } from '@ig/infra/alchemy.run'
import {
  InteractionResponseType,
  MessageFlags,
  type RESTPatchAPIInteractionOriginalResponseJSONBody,
  type RESTPostAPIInteractionCallbackJSONBody,
} from 'discord-api-types/v10'

type DiscordAutocompleteChoice = {
  name: string
  value: string
}

export function createDiscordClient(env: typeof discordBot.Env) {
  const allowedChannelIds = new Set(
    env.DISCORD_ALLOWED_CHANNEL_IDS.split(',')
      .map((item) => item.trim())
      .filter(Boolean),
  )

  async function request<T>(path: string, init: RequestInit): Promise<T> {
    const url = new URL(`https://discord.com/api/v10${path}`)

    const response = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bot ${env.DISCORD_BOT_TOKEN}`,
        'Content-Type': 'application/json',
        ...Object.fromEntries(new Headers(init.headers)),
      },
    })

    if (!response.ok) {
      throw new Error(`Discord API request failed: ${response.status} ${await response.text()}`)
    }

    if (response.status === 204) {
      return undefined as T
    }

    return (await response.json()) as T
  }

  return {
    autocomplete(choices: DiscordAutocompleteChoice[]): RESTPostAPIInteractionCallbackJSONBody {
      return {
        type: InteractionResponseType.ApplicationCommandAutocompleteResult,
        data: { choices },
      }
    },

    defer() {
      return {
        type: InteractionResponseType.DeferredChannelMessageWithSource,
      }
    },

    ephemeralError(content: string): RESTPostAPIInteractionCallbackJSONBody {
      return {
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          content,
          flags: MessageFlags.Ephemeral,
          allowed_mentions: { parse: [] },
        },
      }
    },

    editOriginalInteractionResponse(
      interactionToken: string,
      body: RESTPatchAPIInteractionOriginalResponseJSONBody,
    ) {
      const path = `/webhooks/${env.DISCORD_APPLICATION_ID}/${interactionToken}/messages/@original`
      return request(path, { method: 'PATCH', body: JSON.stringify(body) })
    },

    pong() {
      return { type: InteractionResponseType.Pong }
    },

    isAllowedChannel(channelId: string) {
      return allowedChannelIds.has(channelId)
    },

    isConfiguredGuild(guildId: string) {
      return guildId === env.DISCORD_GUILD_ID
    },
  }
}

export type DiscordClient = ReturnType<typeof createDiscordClient>
