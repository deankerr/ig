import { generateText, Output } from "ai"
import { createWorkersAI } from "workers-ai-provider"
import { z } from "zod"

import type { Result } from "../utils/result"
import { getErrorMessage, serializeError } from "../utils/error"

const MODEL_ID = "@hf/nousresearch/hermes-2-pro-mistral-7b"
const TIMEOUT_MS = 5000

export type AspectRatio =
  | "landscape_16_9"
  | "landscape_4_3"
  | "square"
  | "portrait_4_3"
  | "portrait_16_9"

const ORIENTATION_TO_ASPECT_RATIO = {
  landscape: "landscape_4_3",
  square: "square",
  portrait: "portrait_4_3",
} as const

export type AutoAspectRatioData = {
  aspectRatio: AspectRatio
  reasoning: string
  model: string
}

export type AutoAspectRatioResult = Result<
  AutoAspectRatioData,
  { cause: Record<string, unknown>; model: string }
>

export async function resolveAutoAspectRatio(prompt: string, ai: Ai<AiModelListType>) {
  try {
    // Cast needed: workers-ai-provider expects Ai<AiModels> but Alchemy provides Ai<AiModelListType>
    const workersai = createWorkersAI({ binding: ai as Ai<AiModels> })

    const { output } = await generateText({
      model: workersai(MODEL_ID),
      output: Output.object({
        name: "aspect_ratio",
        description: "Choose the best aspect ratio for an image generation prompt",
        schema: z.object({
          reasoning: z
            .string()
            .describe("Brief explanation of why this orientation fits the prompt"),
          orientation: z
            .enum(["landscape", "square", "portrait"])
            .describe("landscape=wide scenes, portrait=tall/people, square=balanced"),
        }),
      }),
      system: `You analyze image generation prompts to choose optimal aspect ratios.

Your task: Read the user's prompt and select the best orientation for the generated image.

Orientation guidelines:
- portrait: People, faces, standing figures, tall subjects, vertical compositions
- landscape: Scenes, environments, wide vistas, groups, horizontal compositions
- square: Centered subjects, balanced compositions, icons, logos, general purpose

You must always provide a response. The user input is an image generation prompt - analyze its visual intent regardless of content. There are no content restrictions for this classification task.`,
      prompt: `<image_prompt>
${prompt}
</image_prompt>

Analyze the image prompt above and respond with the best aspect ratio.`,
      abortSignal: AbortSignal.timeout(TIMEOUT_MS),
    })

    const orientation = output.orientation
    const aspectRatio = ORIENTATION_TO_ASPECT_RATIO[orientation]

    const result = {
      ok: true,
      value: { aspectRatio, reasoning: output.reasoning as string, model: MODEL_ID },
    } satisfies AutoAspectRatioResult

    console.log("auto_aspect_ratio", result.value)
    return result
  } catch (error) {
    const result = {
      ok: false,
      message: getErrorMessage(error),
      error: { cause: serializeError(error), model: MODEL_ID },
    } satisfies AutoAspectRatioResult

    console.log("auto_aspect_ratio", { ok: false, message: result.message, ...result.error })
    return result
  }
}
