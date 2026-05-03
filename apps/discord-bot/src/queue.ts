import type { GenerationLifecycleEvent } from '@ig/server'

import type { BotContext } from './context'

function truncate(value: string, max = 180) {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`
}

function tag(event: GenerationLifecycleEvent, key: string) {
  return event.tags[key] ?? undefined
}

function getPrompt(event: GenerationLifecycleEvent) {
  const prompt = event.input.positivePrompt
  return typeof prompt === 'string' ? prompt : event.generationId
}

function buildFailureMessage(args: { generationId: string; summary: string }) {
  return {
    content: `${args.summary}\n\nGeneration: \`${args.generationId}\``,
    allowed_mentions: { parse: [] },
  }
}

async function bestEffort(label: string, run: () => Promise<unknown>) {
  try {
    await run()
  } catch (error) {
    console.error(`[discord-bot:${label}] best-effort action failed`, { error })
  }
}

async function handleImagineCompleted(ctx: BotContext, event: GenerationLifecycleEvent) {
  const channelId = tag(event, 'discord:channel_id')
  const interactionToken = tag(event, 'discord:interaction_token')
  const username = tag(event, 'discord:username') ?? 'unknown'
  const [firstArtifact] = event.artifacts ?? []

  if (!firstArtifact) {
    if (!interactionToken) return
    await bestEffort('queue-complete-empty', () =>
      ctx.discord.editOriginalInteractionResponse(
        interactionToken,
        buildFailureMessage({
          generationId: event.generationId,
          summary: 'Generation completed without a usable artifact.',
        }),
      ),
    )
    return
  }

  if (!channelId) {
    console.warn('[discord-bot:queue-complete] missing channel id', {
      generationId: event.generationId,
    })
    return
  }

  const model = ctx.models.resolve(event.model)
  const prompt = getPrompt(event)
  const resultMessage = {
    embeds: [
      {
        title: truncate(prompt),
        description: `by ${username}`,
        image: { url: ctx.ig.artifactFileUrl(firstArtifact.id) },
        fields: [
          { name: 'Model', value: model.label, inline: true },
          { name: 'Seed', value: String(firstArtifact.seed), inline: true },
        ],
        footer: { text: firstArtifact.id },
      },
    ],
    allowed_mentions: { parse: [] },
  }

  console.log('[discord-bot:queue-complete]', {
    generationId: event.generationId,
    artifactId: firstArtifact.id,
  })
  await ctx.discord.createChannelMessage(channelId, resultMessage)

  if (interactionToken) {
    await bestEffort('queue-delete-original', () =>
      ctx.discord.deleteOriginalInteractionResponse(interactionToken),
    )
  }
}

async function handleImagineFailed(ctx: BotContext, event: GenerationLifecycleEvent) {
  const interactionToken = tag(event, 'discord:interaction_token')
  if (!interactionToken) return

  await bestEffort('queue-failed', () =>
    ctx.discord.editOriginalInteractionResponse(
      interactionToken,
      buildFailureMessage({
        generationId: event.generationId,
        summary: event.error ?? 'Generation failed unexpectedly.',
      }),
    ),
  )
}

export async function handleGenerationEvent(ctx: BotContext, event: GenerationLifecycleEvent) {
  if (tag(event, 'discord:command') !== 'imagine') return

  if (event.type === 'generation.completed') {
    await handleImagineCompleted(ctx, event)
    return
  }

  if (event.type === 'generation.failed') {
    await handleImagineFailed(ctx, event)
  }
}
