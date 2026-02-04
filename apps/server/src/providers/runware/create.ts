/**
 * Runware generation creation
 *
 * Owns the complete generation flow for Runware provider.
 */

const RUNWARE_API_URL = "https://api.runware.ai/v1"

type AspectRatio = "landscape_16_9" | "landscape_4_3" | "square" | "portrait_4_3" | "portrait_16_9"

// Map provider-agnostic aspect ratios to Runware pixel dimensions
const ASPECT_RATIO_DIMENSIONS: Record<AspectRatio, { width: number; height: number }> = {
  landscape_16_9: { width: 1344, height: 768 },
  landscape_4_3: { width: 1152, height: 896 },
  square: { width: 1024, height: 1024 },
  portrait_4_3: { width: 896, height: 1152 },
  portrait_16_9: { width: 768, height: 1344 },
}

type AutoAspectRatioResult =
  | {
      ok: true
      data: { aspectRatio: AspectRatio; reasoning: string; model: string }
      error: undefined
    }
  | {
      ok: false
      data: undefined
      error: { error: Record<string, unknown>; model: string }
    }

type GenerationService = {
  create(args: {
    provider: string
    model: string
    input: Record<string, unknown>
    tags: string[]
    slug?: string
    providerMetadata?: Record<string, unknown>
  }): Promise<{ id: string; slug: string | null }>
  markSubmitted(args: {
    id: string
    requestId: string
    providerMetadata?: Record<string, unknown>
  }): Promise<void>
}

export type CreateContext = {
  env: { RUNWARE_KEY: string; PUBLIC_URL: string }
  services: {
    generations: GenerationService
    autoAspectRatio: (prompt: string) => Promise<AutoAspectRatioResult>
  }
}

export type CreateRequest = {
  model: string
  input: Record<string, unknown>
  tags?: string[]
  slug?: string
  autoAspectRatio?: boolean
}

type RunwareResponse = {
  data?: Array<{ taskType: string; taskUUID: string; [key: string]: unknown }>
  error?: string
}

export async function create(ctx: CreateContext, request: CreateRequest) {
  const input = { ...request.input }
  let providerMetadata: Record<string, unknown> | undefined

  // Normalize prompt field
  input.positivePrompt ??= input.prompt

  // Auto aspect ratio - runware needs dimensions
  if (request.autoAspectRatio && input.prompt && !input.width && !input.height) {
    const result = await ctx.services.autoAspectRatio(input.prompt as string)

    if (result.ok) {
      const dims = ASPECT_RATIO_DIMENSIONS[result.data.aspectRatio]
      input.width = dims.width
      input.height = dims.height
      providerMetadata = {
        ig_preprocessing: {
          autoAspectRatio: {
            ...result.data,
            ...dims,
          },
        },
      }
      console.log("auto_aspect_ratio_created", { ...result.data, ...dims })
    } else {
      console.log("auto_aspect_ratio_error", result.error)
      providerMetadata = { ig_preprocessing: { autoAspectRatio: { error: result.error } } }
    }
  }

  // Apply runware defaults
  input.taskType ??= "imageInference"
  input.includeCost ??= true
  input.width ??= 1024
  input.height ??= 1024

  // Create record with metadata included
  const { id, slug } = await ctx.services.generations.create({
    provider: "runware",
    model: request.model,
    input,
    tags: request.tags ?? [],
    slug: request.slug,
    providerMetadata,
  })

  // Submit to Runware API
  const webhookUrl = `${ctx.env.PUBLIC_URL}/webhooks/runware?generation_id=${id}`
  const response = await fetch(RUNWARE_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify([
      { taskType: "authentication", apiKey: ctx.env.RUNWARE_KEY },
      { ...input, model: request.model, taskUUID: id, webhookURL: webhookUrl },
    ]),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Runware API error: ${response.status} ${text}`)
  }

  const result = (await response.json()) as RunwareResponse
  if (result.error) {
    throw new Error(`Runware API error: ${result.error}`)
  }

  // For Runware, the taskUUID is the request ID
  await ctx.services.generations.markSubmitted({ id, requestId: id })

  console.log("generation_created", {
    id,
    slug,
    provider: "runware",
    model: request.model,
    requestId: id,
  })
  return { id, slug, requestId: id }
}
