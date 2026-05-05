import type { discordBot } from '@ig/infra/alchemy.run'
import {
  type APIMessage,
  InteractionResponseType,
  MessageFlags,
  type RESTPostAPIChannelMessageJSONBody,
  type RESTPatchAPIInteractionOriginalResponseJSONBody,
  type RESTPostAPIInteractionCallbackJSONBody,
  type RESTPutAPIApplicationGuildCommandsJSONBody,
} from 'discord-api-types/v10'

export function createDiscordClient(env: typeof discordBot.Env) {
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

    deleteOriginalInteractionResponse(interactionToken: string) {
      const path = `/webhooks/${env.DISCORD_APPLICATION_ID}/${interactionToken}/messages/@original`
      return request(path, { method: 'DELETE' })
    },

    createChannelMessage(channelId: string, body: RESTPostAPIChannelMessageJSONBody) {
      const path = `/channels/${channelId}/messages`
      return request<APIMessage>(path, { method: 'POST', body: JSON.stringify(body) })
    },

    registerGuildCommands(guildId: string, commands: RESTPutAPIApplicationGuildCommandsJSONBody) {
      const path = `/applications/${env.DISCORD_APPLICATION_ID}/guilds/${guildId}/commands`
      return request<unknown>(path, { method: 'PUT', body: JSON.stringify(commands) })
    },

    pong() {
      return { type: InteractionResponseType.Pong }
    },

    isConfiguredGuild(guildId: string) {
      return guildId === env.DISCORD_GUILD_ID
    },
  }
}

export type DiscordClient = ReturnType<typeof createDiscordClient>
