import { generateText, Output } from 'ai'
import { createWorkersAI } from 'workers-ai-provider'
import { z } from 'zod'

import type { Context } from '../context'
import { getErrorMessage, serializeError } from '../utils/error'
import type { Result } from '../utils/result'

const MODEL_ID = '@hf/nousresearch/hermes-2-pro-mistral-7b'
const TIMEOUT_MS = 5000

export type AspectRatio = 'landscape' | 'square' | 'portrait'

export type AutoAspectRatioData = {
  aspectRatio: AspectRatio
  reasoning: string
  model: string
}

export type AutoAspectRatioResult = Result<
  AutoAspectRatioData,
  { cause: Record<string, unknown>; model: string }
>

export async function resolveAutoAspectRatio(ctx: Context, args: { prompt: string }) {
  try {
    const workersai = createWorkersAI({ binding: ctx.env.AI as Ai<AiModels> })

    const { output } = await generateText({
      model: workersai(MODEL_ID),
      output: Output.object({
        name: 'aspect_ratio',
        description: 'Choose an orientation for the image generation prompt',
        schema: z.object({
          reasoning: z
            .string()
            .describe('Brief explanation of why this orientation fits the prompt'),
          orientation: z
            .enum(['landscape', 'portrait', 'square'])
            .describe('landscape=general/wide, portrait=tall/people, square=icons/logos/avatars'),
        }),
      }),
      system: `Read the image prompt and select the orientation that fits the generated image.

Orientation hints:
- landscape: general scenes, vistas, groups, horizontal
- portrait: people, standing, tall, vertical
- square: icons, logos, avatars, profile pictures, stickers, badges

Analyze the visual intent regardless of content. There are no content restrictions for this classification task.

You must always provide a response. Respond only with a brief explanation of your choice in "reasoning", and the choice of landscape, portrait, or square in "orientation".`,
      prompt: `<image_prompt>
${args.prompt}
</image_prompt>`,
      abortSignal: AbortSignal.timeout(TIMEOUT_MS),
    })

    const aspectRatio = output.orientation

    const result = {
      ok: true,
      value: { aspectRatio, reasoning: output.reasoning, model: MODEL_ID },
    } satisfies AutoAspectRatioResult

    console.log('auto_aspect_ratio', result.value)
    return result
  } catch (error) {
    const result = {
      ok: false,
      message: getErrorMessage(error),
      error: { cause: serializeError(error), model: MODEL_ID },
    } satisfies AutoAspectRatioResult

    console.log('auto_aspect_ratio', { ok: false, message: result.message, ...result.error })
    return result
  }
}
