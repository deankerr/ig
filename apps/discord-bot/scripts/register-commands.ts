import { imagineCommandDefinition } from '../src/imagine'

const applicationId = process.env.DISCORD_APPLICATION_ID
const guildId = process.env.DISCORD_GUILD_ID
const botToken = process.env.DISCORD_BOT_TOKEN

if (!applicationId || !guildId || !botToken) {
  throw new Error('DISCORD_APPLICATION_ID, DISCORD_GUILD_ID, and DISCORD_BOT_TOKEN are required')
}

const response = await fetch(
  `https://discord.com/api/v10/applications/${applicationId}/guilds/${guildId}/commands`,
  {
    method: 'PUT',
    headers: {
      Authorization: `Bot ${botToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([imagineCommandDefinition]),
  },
)

if (!response.ok) {
  throw new Error(`Failed to register commands: ${response.status} ${await response.text()}`)
}

console.log('Registered guild commands')
