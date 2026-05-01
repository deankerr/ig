import type { discordBot } from '@ig/infra/alchemy.run'

import type { DiscordClient } from '../discord'
import type { IgClient } from '../ig'
import type { Models } from '../models'

export type ImagineContext = {
  waitUntil: (promise: Promise<unknown>) => void
  env: typeof discordBot.Env
  ig: IgClient
  discord: DiscordClient
  models: Models
}
