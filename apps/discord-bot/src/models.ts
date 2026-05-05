import type { discordBot } from '@ig/infra/alchemy.run'

export type AllowedModel = {
  air: string
  label: string
}

const FALLBACK_MODEL: AllowedModel = { air: 'runware:100@1', label: 'FLUX.1 [schnell]' }

export function parseModelAllowlistText(value: string): AllowedModel[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const spaceIndex = line.indexOf(' ')

      if (spaceIndex === -1) {
        return { air: line, label: line }
      }

      const air = line.slice(0, spaceIndex)
      const label = line.slice(spaceIndex + 1).trim()

      return { air, label: label || air }
    })
    .filter((item) => item.air)
}

export function serializeModelAllowlistText(models: AllowedModel[]): string {
  return models.map((m) => `${m.air} ${m.label}`).join('\n')
}

export async function saveModels(env: typeof discordBot.Env, models: AllowedModel[]) {
  await env.DISCORD_BOT_CONFIG.put('models', JSON.stringify(models))
}

export async function createModels(env: typeof discordBot.Env) {
  const raw = await env.DISCORD_BOT_CONFIG.get('models')
  const list: AllowedModel[] = raw ? (JSON.parse(raw) as AllowedModel[]) : []
  const byAir = new Map(list.map((model) => [model.air, model]))

  const choices = list.length > 0 ? list : [FALLBACK_MODEL]

  return {
    list,
    byAir,
    choices,

    resolve(value?: string) {
      if (list.length === 0 && !value) {
        console.warn('[discord-bot:models] no models configured in KV, using hardcoded fallback')
        return FALLBACK_MODEL
      }

      const air = value ?? list[0]?.air

      if (!air) {
        console.warn('[discord-bot:models] no models configured in KV, using hardcoded fallback')
        return FALLBACK_MODEL
      }

      return byAir.get(air) ?? { air, label: air }
    },
  }
}

export type Models = Awaited<ReturnType<typeof createModels>>
