import {
  InteractionResponseType,
  MessageFlags,
  type RESTPatchAPIInteractionOriginalResponseJSONBody,
  type RESTPostAPIInteractionCallbackJSONBody,
} from 'discord-api-types/v10'

const MAX_SIGNATURE_AGE_MS = 5 * 60 * 1000

type DiscordAutocompleteChoice = {
  name: string
  value: string
}

function hexToBytes(value: string) {
  if (value.length % 2 !== 0) {
    throw new Error('Invalid hex string length')
  }

  const bytes = new Uint8Array(value.length / 2)
  for (let index = 0; index < value.length; index += 2) {
    bytes[index / 2] = Number.parseInt(value.slice(index, index + 2), 16)
  }
  return bytes
}

async function discordRequest<T>(env: Env, path: string, init: RequestInit): Promise<T> {
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

export async function verifyDiscordRequest(
  rawBody: string,
  signature: string | undefined,
  timestamp: string | undefined,
  publicKey: string,
) {
  if (!signature || !timestamp) return false

  const numericTimestamp = Number(timestamp) * 1000
  if (!Number.isFinite(numericTimestamp)) return false
  if (Math.abs(Date.now() - numericTimestamp) > MAX_SIGNATURE_AGE_MS) return false

  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', hexToBytes(publicKey), 'Ed25519', false, [
    'verify',
  ])

  return crypto.subtle.verify(
    'Ed25519',
    key,
    hexToBytes(signature),
    encoder.encode(timestamp + rawBody),
  )
}

export function pong(): RESTPostAPIInteractionCallbackJSONBody {
  return { type: InteractionResponseType.Pong }
}

export function deferPublic(): RESTPostAPIInteractionCallbackJSONBody {
  return {
    type: InteractionResponseType.DeferredChannelMessageWithSource,
  }
}

export function autocomplete(
  choices: DiscordAutocompleteChoice[],
): RESTPostAPIInteractionCallbackJSONBody {
  return {
    type: InteractionResponseType.ApplicationCommandAutocompleteResult,
    data: { choices },
  }
}

export function ephemeralError(content: string): RESTPostAPIInteractionCallbackJSONBody {
  return {
    type: InteractionResponseType.ChannelMessageWithSource,
    data: {
      content,
      flags: MessageFlags.Ephemeral,
      allowed_mentions: { parse: [] },
    },
  }
}

export async function editOriginalInteractionResponse(
  env: Env,
  interactionToken: string,
  body: RESTPatchAPIInteractionOriginalResponseJSONBody,
) {
  const path = `/webhooks/${env.DISCORD_APPLICATION_ID}/${interactionToken}/messages/@original`
  return discordRequest(env, path, { method: 'PATCH', body: JSON.stringify(body) })
}
