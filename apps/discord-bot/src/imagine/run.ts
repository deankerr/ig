import {
  ApplicationCommandOptionType,
  type APIChatInputApplicationCommandInteraction,
} from 'discord-api-types/v10'
import { z } from 'zod'

import type { IgCreateGenerationInput } from '../ig'
import type { ImagineContext } from './context'

const promptSchema = z.string().min(1, 'Prompt is required')

function getStringOption(
  interaction: APIChatInputApplicationCommandInteraction,
  name: string,
): string | undefined {
  const option = interaction.data.options?.find((item) => item.name === name)

  if (!option || option.type !== ApplicationCommandOptionType.String) {
    return undefined
  }

  return typeof option.value === 'string' ? option.value : undefined
}

function getReferenceImageUrl(interaction: APIChatInputApplicationCommandInteraction) {
  const option = interaction.data.options?.find((item) => item.name === 'reference_image')

  if (!option) {
    return undefined
  }

  if (option.type !== ApplicationCommandOptionType.Attachment || typeof option.value !== 'string') {
    throw new Error('Reference image is invalid')
  }

  const attachment = interaction.data.resolved?.attachments?.[option.value]

  if (!attachment) {
    throw new Error('Reference image is invalid')
  }

  return [attachment.url]
}

function parseInteractionIdentity(
  ctx: ImagineContext,
  interaction: APIChatInputApplicationCommandInteraction,
) {
  const interactionIdentitySchema = z
    .object({
      id: z.string(),
      token: z.string(),
      guild_id: z
        .string()
        .refine((value) => ctx.discord.isConfiguredGuild(value), 'Unauthorized guild'),
      channel_id: z
        .string()
        .refine((value) => ctx.discord.isAllowedChannel(value), 'Unauthorized channel'),
      member: z.object({
        user: z.object({
          id: z.string(),
          username: z.string(),
        }),
      }),
    })
    .transform((value) => ({
      interactionId: value.id,
      interactionToken: value.token,
      guildId: value.guild_id,
      channelId: value.channel_id,
      userId: value.member.user.id,
      username: value.member.user.username,
    }))

  return interactionIdentitySchema.parse(interaction)
}

export async function runImagine(
  ctx: ImagineContext,
  interaction: APIChatInputApplicationCommandInteraction,
) {
  const identity = parseInteractionIdentity(ctx, interaction)
  const requestedModel = getStringOption(interaction, 'model')
  const model = ctx.models.resolve(requestedModel)
  const positivePrompt = promptSchema.parse(getStringOption(interaction, 'prompt'))

  const input: IgCreateGenerationInput = {
    model: model.air,
    positivePrompt: positivePrompt,
    referenceImages: getReferenceImageUrl(interaction),
    numberResults: 1,
    dimensions: ctx.ig.parseDimensionValue(getStringOption(interaction, 'aspect')),
    tags: {
      'discord:guild_id': identity.guildId,
      'discord:channel_id': identity.channelId,
      'discord:user_id': identity.userId,
      'discord:username': identity.username,
      'discord:interaction_id': identity.interactionId,
      'discord:interaction_token': identity.interactionToken,
      'discord:command': 'imagine',
    },
  }

  console.log(`[runImage:create] ${input.positivePrompt}`, {
    model: input.model,
    channelId: identity.channelId,
    userId: identity.userId,
  })
  const result = await ctx.ig.createGeneration(input)
  console.log(`[runImage:queued] ${input.positivePrompt}`, { id: result.id })
}
