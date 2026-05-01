import type { discordBot } from '@ig/infra/alchemy.run'

export type AllowedModel = {
  air: string
  label: string
}

function parseModelAllowlist(value: string): AllowedModel[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const separatorIndex = item.lastIndexOf('|')

      if (separatorIndex === -1) {
        return { air: item, label: item }
      }

      const label = item.slice(0, separatorIndex).trim()
      const air = item.slice(separatorIndex + 1).trim()

      return {
        air,
        label: label || air,
      }
    })
    .filter((item) => item.air)
}

export function createModels(env: typeof discordBot.Env) {
  const list = parseModelAllowlist(env.DISCORD_MODEL_ALLOWLIST)
  const byAir = new Map(list.map((model) => [model.air, model]))

  return {
    list,
    byAir,

    resolve(value?: string) {
      const air = value ?? list[0]?.air

      if (!air) {
        throw new Error('No Discord fallback model is configured')
      }

      return byAir.get(air) ?? { air, label: air }
    },
  }
}

export type Models = ReturnType<typeof createModels>
