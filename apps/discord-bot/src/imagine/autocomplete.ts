import {
  ApplicationCommandOptionType,
  type APIApplicationCommandAutocompleteInteraction,
} from 'discord-api-types/v10'
import { z } from 'zod'

import type { IgModelSearchResult } from '../ig'
import { parseModelAllowlist } from './model-allowlist'

const autocompleteModelOptionSchema = z.object({
  type: z.literal(ApplicationCommandOptionType.String),
  name: z.literal('model'),
  value: z.string(),
  focused: z.boolean().optional(),
})

const imagineAutocompleteInteractionSchema = z.object({
  data: z.object({
    options: z.array(z.union([autocompleteModelOptionSchema])),
  }),
})

const imagineAutocompleteInputSchema = z.object({
  query: z.string(),
})

export type ImagineAutocompleteContext = {
  env: Env
  searchModels: (query: string) => Promise<IgModelSearchResult>
}

function parseImagineAutocompleteInput(interaction: APIApplicationCommandAutocompleteInteraction) {
  const parsed = imagineAutocompleteInteractionSchema.parse(interaction)
  const focusedModelOption = parsed.data.options.find(
    (option) => option.name === 'model' && option.focused,
  )

  return imagineAutocompleteInputSchema.parse({
    query: focusedModelOption?.value ?? '',
  })
}

export async function handleImagineAutocomplete(
  ctx: ImagineAutocompleteContext,
  interaction: APIApplicationCommandAutocompleteInteraction,
) {
  const allowlist = parseModelAllowlist(ctx.env.DISCORD_MODEL_ALLOWLIST)
  const allowlistByAir = new Map(allowlist.map((item) => [item.air, item]))
  const { query } = parseImagineAutocompleteInput(interaction)

  if (!query) {
    return allowlist
      .slice(0, 25)
      .map((item) => ({ name: item.label.slice(0, 100), value: item.air }))
  }

  const results = await ctx.searchModels(query)
  return results.results
    .filter((model) => allowlistByAir.has(model.air))
    .slice(0, 25)
    .map((model) => ({
      name:
        allowlistByAir.get(model.air)?.label.slice(0, 100) ??
        `${model.name} ${model.version}`.slice(0, 100),
      value: model.air,
    }))
}
