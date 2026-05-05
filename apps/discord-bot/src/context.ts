import type { discordBot } from '@ig/infra/alchemy.run'

import { createDiscordClient } from './discord'
import { createIgClient } from './ig'
import { createModels } from './models'

export async function createContext(env: typeof discordBot.Env) {
  return {
    env,
    ig: createIgClient({ baseUrl: env.IG_BASE_URL, apiKey: env.IG_API_KEY }),
    discord: createDiscordClient(env),
    models: await createModels(env),
  }
}

export type BotContext = Awaited<ReturnType<typeof createContext>>
