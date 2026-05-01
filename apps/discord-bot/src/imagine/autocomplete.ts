import {
  ApplicationCommandOptionType,
  type APIApplicationCommandAutocompleteInteraction,
} from 'discord-api-types/v10'
import { z } from 'zod'

import type { ImagineContext } from './context'

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
  ctx: ImagineContext,
  interaction: APIApplicationCommandAutocompleteInteraction,
) {
  const { query } = parseImagineAutocompleteInput(interaction)

  if (!query) {
    return ctx.models.list
      .slice(0, 25)
      .map((item) => ({ name: item.label.slice(0, 100), value: item.air }))
  }

  const results = await ctx.ig.searchModels(query)
  return results.results
    .filter((model) => ctx.models.byAir.has(model.air))
    .slice(0, 25)
    .map((model) => ({
      name:
        ctx.models.byAir.get(model.air)?.label.slice(0, 100) ??
        `${model.name} ${model.version}`.slice(0, 100),
      value: model.air,
    }))
}
