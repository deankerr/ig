import type { GenerationLifecycleEvent } from '@ig/server'

import type { BotContext } from '../context'

function truncate(value: string, max = 180) {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`
}

function getPrompt(event: GenerationLifecycleEvent) {
  const prompt = event.input.positivePrompt
  return typeof prompt === 'string' ? prompt : event.generationId
}

async function handleCompleted(ctx: BotContext, event: GenerationLifecycleEvent) {
  const {
    'discord-bot:channel_id': channelId,
    'discord-bot:interaction_token': interactionToken,
    'discord-bot:username': username = 'unknown',
  } = event.tags

  const [firstArtifact] = event.artifacts ?? []

  if (!firstArtifact) {
    if (!interactionToken) return
    await ctx.discord.editOriginalInteractionResponse(interactionToken, {
      content: `Generation completed without a usable artifact.\n\nGeneration: \`${event.generationId}\``,
      allowed_mentions: { parse: [] },
    })
    return
  }

  if (!channelId) {
    console.warn('[discord-bot:imagine-events] missing channel_id', {
      generationId: event.generationId,
    })
    return
  }

  const model = ctx.models.resolve(event.model)
  const prompt = getPrompt(event)

  console.log('[discord-bot:imagine-events] completed', {
    generationId: event.generationId,
    artifactId: firstArtifact.id,
  })

  await ctx.discord.createChannelMessage(channelId, {
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
  })

  // cleanup the deferred message — best-effort since the image was already posted
  if (interactionToken) {
    try {
      await ctx.discord.deleteOriginalInteractionResponse(interactionToken)
    } catch (error) {
      console.error('[discord-bot:imagine-events] failed to delete deferred message', { error })
    }
  }
}

async function handleFailed(ctx: BotContext, event: GenerationLifecycleEvent) {
  const interactionToken = event.tags['discord:interaction_token']
  if (!interactionToken) return

  await ctx.discord.editOriginalInteractionResponse(interactionToken, {
    content: `${event.error ?? 'Generation failed unexpectedly.'}\n\nGeneration: \`${event.generationId}\``,
    allowed_mentions: { parse: [] },
  })
}

export async function handleImagineEvent(ctx: BotContext, event: GenerationLifecycleEvent) {
  if (event.type === 'generation.completed') {
    await handleCompleted(ctx, event)
    return
  }

  if (event.type === 'generation.failed') {
    await handleFailed(ctx, event)
  }
}
