import {
  ApplicationCommandOptionType,
  type APIChatInputApplicationCommandInteraction,
} from 'discord-api-types/v10'
import { ZodError, z } from 'zod'

import type { IgCreateGenerationInput } from '../ig'
import type { ImagineContext } from './context'

function truncate(value: string, max = 180) {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`
}

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

function getErrorMessage(error: unknown) {
  if (error instanceof ZodError) {
    const issue = error.issues[0]
    return issue?.message ?? 'Invalid imagine command input'
  }

  return error instanceof Error ? error.message : 'Generation failed unexpectedly.'
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

function buildImagineFailureMessage(args: { generationId: string; summary: string }) {
  return {
    content: `${args.summary}\n\nGeneration: \`${args.generationId}\``,
    allowed_mentions: { parse: [] },
  }
}

async function executeImagine(
  ctx: ImagineContext,
  args: {
    identity: ReturnType<typeof parseInteractionIdentity>
    model: { air: string; label: string }
    positivePrompt: string
    referenceImages?: string[]
    dimensions: IgCreateGenerationInput['dimensions']
  },
) {
  const input: IgCreateGenerationInput = {
    model: args.model.air,
    positivePrompt: args.positivePrompt,
    referenceImages: args.referenceImages,
    numberResults: 1,
    sync: true,
    dimensions: args.dimensions,
    tags: {
      'discord:guild_id': args.identity.guildId,
      'discord:channel_id': args.identity.channelId,
      'discord:user_id': args.identity.userId,
      'discord:username': args.identity.username,
      'discord:interaction_id': args.identity.interactionId,
      'discord:command': 'imagine',
    },
  }

  try {
    const result = await ctx.ig.createGeneration(input)
    const [firstArtifact] = result.artifacts

    if (!firstArtifact) {
      await ctx.discord.editOriginalInteractionResponse(
        args.identity.interactionToken,
        buildImagineFailureMessage({
          generationId: result.id,
          summary: 'Generation completed without a usable artifact.',
        }),
      )
      return
    }

    const resultMessage = {
      embeds: [
        {
          title: truncate(args.positivePrompt),
          description: `by ${args.identity.username}`,
          image: { url: ctx.ig.artifactFileUrl(firstArtifact.id) },
          fields: [
            { name: 'Model', value: args.model.label, inline: true },
            { name: 'Seed', value: String(firstArtifact.seed), inline: true },
          ],
          footer: { text: firstArtifact.id },
        },
      ],
      allowed_mentions: { parse: [] },
    }

    console.log('[discord-bot:result-message]', JSON.stringify(resultMessage))

    await ctx.discord.editOriginalInteractionResponse(args.identity.interactionToken, resultMessage)
  } catch (error) {
    const message = getErrorMessage(error)
    await ctx.discord.editOriginalInteractionResponse(
      args.identity.interactionToken,
      buildImagineFailureMessage({
        generationId: 'unknown',
        summary: message,
      }),
    )
  }
}

export function runImagine(
  ctx: ImagineContext,
  interaction: APIChatInputApplicationCommandInteraction,
) {
  const identity = parseInteractionIdentity(ctx, interaction)
  const requestedModel = getStringOption(interaction, 'model')
  const resolvedModel = ctx.models.resolve(requestedModel)
  const positivePrompt = promptSchema.parse(getStringOption(interaction, 'prompt'))

  ctx.waitUntil(
    executeImagine(ctx, {
      identity,
      model: resolvedModel,
      positivePrompt,
      referenceImages: getReferenceImageUrl(interaction),
      dimensions: ctx.ig.parseDimensionValue(getStringOption(interaction, 'aspect')),
    }),
  )
}
