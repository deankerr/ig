import type { RESTPatchAPIInteractionOriginalResponseJSONBody } from 'discord-api-types/v10'

import type { IgSyncGeneration } from '../ig'

function truncate(value: string, max = 180) {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`
}

function getPrompt(input: Record<string, unknown>) {
  const prompt = input.positivePrompt
  return typeof prompt === 'string' ? prompt : 'Generated image'
}

function artifactUrl(env: Env, artifact: Pick<IgSyncGeneration['artifacts'][number], 'id'>) {
  return new URL(`/artifacts/${artifact.id}/file?f=auto`, env.IG_BASE_URL).toString()
}

export function buildImagineFailureMessage(args: { generationId: string; summary: string }) {
  return {
    content: `${args.summary}\n\nGeneration: \`${args.generationId}\``,
    allowed_mentions: { parse: [] },
  } satisfies RESTPatchAPIInteractionOriginalResponseJSONBody
}

export function buildImagineSuccessMessage(args: {
  env: Env
  result: IgSyncGeneration
  artifact: IgSyncGeneration['artifacts'][number]
  modelLabel: string
  username: string
}): RESTPatchAPIInteractionOriginalResponseJSONBody {
  const prompt = truncate(getPrompt(args.result.generation.input))
  const imageUrl = artifactUrl(args.env, args.artifact)

  return {
    embeds: [
      {
        title: prompt,
        description: `by ${args.username}`,
        image: { url: imageUrl },
        fields: [
          { name: 'Model', value: args.modelLabel, inline: true },
          { name: 'Seed', value: String(args.artifact.seed), inline: true },
        ],
        footer: { text: args.artifact.id },
      },
    ],
    allowed_mentions: { parse: [] },
  }
}
