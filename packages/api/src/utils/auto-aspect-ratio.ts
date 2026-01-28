import { generateText, Output } from "ai"
import { createWorkersAI, type WorkersAI } from "workers-ai-provider"
import { z } from "zod"
import type { Context } from "../context"

type TextGenerationModels = Parameters<WorkersAI>[0]

// Configuration
const MODEL_ID: TextGenerationModels = "@hf/nousresearch/hermes-2-pro-mistral-7b"
const TIMEOUT_MS = 5000

const FAL_ASPECT_RATIO_MAP = {
  landscape: "landscape_4_3",
  square: "square_hd",
  portrait: "portrait_4_3",
} as const

/**
 * Serialize any error to a plain object for storage.
 * Copies name, message, and all enumerable properties (AI SDK errors add fields like
 * `text`, `usage`, `finishReason`, `url`, `statusCode`, etc.)
 */
function serializeError(error: unknown): Record<string, unknown> {
  if (!Error.isError(error)) {
    return { message: String(error) }
  }

  const serialized: Record<string, unknown> = {
    name: error.name,
    message: error.message,
  }

  // Copy all enumerable own properties (excludes cause, handled separately)
  for (const key of Object.keys(error)) {
    if (key === "cause") continue
    const value = (error as unknown as Record<string, unknown>)[key]
    if (typeof value === "function" || typeof value === "symbol") continue
    serialized[key] = value
  }

  // Handle cause recursively
  if (error.cause !== undefined) {
    serialized.cause = Error.isError(error.cause) ? serializeError(error.cause) : error.cause
  }

  return serialized
}

export async function resolveAutoAspectRatio(prompt: string, ai: Context["env"]["AI"]) {
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

    return {
      data: {
        imageSize: FAL_ASPECT_RATIO_MAP[output.orientation],
        reasoning: output.reasoning,
        model: MODEL_ID,
      },
      ok: true,
      error: undefined,
    } as const
  } catch (error) {
    const serialized = serializeError(error)
    return {
      error: {
        error: serialized,
        model: MODEL_ID,
      },
      ok: false,
      data: undefined,
    } as const
  }
}
