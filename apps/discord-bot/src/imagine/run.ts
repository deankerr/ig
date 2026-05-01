import {
  ApplicationCommandOptionType,
  type APIChatInputApplicationCommandInteraction,
  type RESTPatchAPIInteractionOriginalResponseJSONBody,
} from 'discord-api-types/v10'
import { ZodError, z } from 'zod'

import type { IgCreateGenerationInput, IgSyncGeneration } from '../ig'
import { parseModelAllowlist } from './model-allowlist'
import { buildImagineFailureMessage, buildImagineSuccessMessage } from './response'

export type ImagineContext = {
  env: Env
  waitUntil: (promise: Promise<unknown>) => void
  createGeneration: (input: IgCreateGenerationInput) => Promise<IgSyncGeneration>
  editOriginalResponse: (
    interactionToken: string,
    body: RESTPatchAPIInteractionOriginalResponseJSONBody,
  ) => Promise<unknown>
}

const imagineDimensions = ['auto', 'square', 'landscape', 'portrait'] as const

const promptSchema = z.string().min(1, 'Prompt is required')

type ImagineTags = {
  'discord:guild_id': string
  'discord:channel_id': string
  'discord:user_id': string
  'discord:username': string
  'discord:interaction_id': string
  'discord:command': 'imagine'
}

type ParsedImagineCommand = {
  model?: string
  positivePrompt: string
  referenceImages?: string[]
  numberResults: 1
  sync: true
  dimensions: IgCreateGenerationInput['dimensions']
  tags: ImagineTags
  interactionToken: string
}

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

function getReferenceImageUrl(
  interaction: APIChatInputApplicationCommandInteraction,
): string | undefined {
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

  return attachment.url
}

function parseDimension(
  interaction: APIChatInputApplicationCommandInteraction,
): IgCreateGenerationInput['dimensions'] {
  const value = getStringOption(interaction, 'aspect')

  if (!value) {
    return 'auto' as const
  }

  return imagineDimensions.includes(value as (typeof imagineDimensions)[number])
    ? (value as (typeof imagineDimensions)[number])
    : 'auto'
}

function parseImagineCommand(
  interaction: APIChatInputApplicationCommandInteraction,
): ParsedImagineCommand {
  const user = interaction.user ?? interaction.member?.user

  if (!interaction.guild_id) {
    throw new Error('Guild is required')
  }

  if (!interaction.channel_id) {
    throw new Error('Channel is required')
  }

  if (!user?.id) {
    throw new Error('User is required')
  }

  if (!user.username) {
    throw new Error('Username is required')
  }

  const prompt = promptSchema.parse(getStringOption(interaction, 'prompt'))
  const referenceImageUrl = getReferenceImageUrl(interaction)

  return {
    model: getStringOption(interaction, 'model'),
    positivePrompt: prompt,
    referenceImages: referenceImageUrl ? [referenceImageUrl] : undefined,
    numberResults: 1,
    sync: true,
    dimensions: parseDimension(interaction),
    tags: {
      'discord:guild_id': interaction.guild_id,
      'discord:channel_id': interaction.channel_id,
      'discord:user_id': user.id,
      'discord:username': user.username,
      'discord:interaction_id': interaction.id,
      'discord:command': 'imagine',
    },
    interactionToken: interaction.token,
  }
}

function getErrorMessage(error: unknown) {
  if (error instanceof ZodError) {
    const issue = error.issues[0]
    return issue?.message ?? 'Invalid imagine command input'
  }

  return error instanceof Error ? error.message : 'Generation failed unexpectedly.'
}

async function executeImagine(
  ctx: ImagineContext,
  interactionToken: string,
  username: string,
  modelLabel: string,
  input: IgCreateGenerationInput,
) {
  try {
    const result = await ctx.createGeneration(input)
    const [firstArtifact] = result.artifacts

    if (!firstArtifact) {
      await ctx.editOriginalResponse(
        interactionToken,
        buildImagineFailureMessage({
          generationId: result.id,
          summary: 'Generation completed without a usable artifact.',
        }),
      )
      return
    }

    const resultMessage = buildImagineSuccessMessage({
      env: ctx.env,
      result,
      artifact: firstArtifact,
      modelLabel,
      username,
    })

    console.log('[discord-bot:result-message]', JSON.stringify(resultMessage))

    await ctx.editOriginalResponse(interactionToken, resultMessage)
  } catch (error) {
    const message = getErrorMessage(error)
    await ctx.editOriginalResponse(
      interactionToken,
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
  const input = parseImagineCommand(interaction)

  const allowedChannelIds = new Set(
    ctx.env.DISCORD_ALLOWED_CHANNEL_IDS.split(',')
      .map((item) => item.trim())
      .filter(Boolean),
  )

  if (!allowedChannelIds.has(input.tags['discord:channel_id'])) {
    throw new Error('This command can only be used in configured channels')
  }

  const availableModels = parseModelAllowlist(ctx.env.DISCORD_MODEL_ALLOWLIST)
  const fallbackModel = availableModels[0]
  const resolvedModel = input.model ?? fallbackModel?.air

  if (!resolvedModel) {
    throw new Error('No Discord fallback model is configured')
  }

  const resolvedModelLabel =
    availableModels.find((item) => item.air === resolvedModel)?.label ?? resolvedModel

  const { interactionToken, model: _requestedModel, ...imagineRequestBase } = input

  const imagineRequest: IgCreateGenerationInput = {
    ...imagineRequestBase,
    model: resolvedModel,
  }

  ctx.waitUntil(
    executeImagine(
      ctx,
      interactionToken,
      input.tags['discord:username'],
      resolvedModelLabel,
      imagineRequest,
    ),
  )
}
