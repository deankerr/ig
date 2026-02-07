/**
 * Runware generation creation
 *
 * Owns the complete generation flow for Runware provider.
 */

import type { AspectRatio, AutoAspectRatioResult, GenerationService } from '../../services'

const RUNWARE_API_URL = 'https://api.runware.ai/v1'

// Map provider-agnostic aspect ratios to Runware pixel dimensions
const ASPECT_RATIO_DIMENSIONS: Record<AspectRatio, { width: number; height: number }> = {
  landscape_16_9: { width: 1920, height: 1088 },
  landscape_4_3: { width: 1536, height: 1152 },
  square: { width: 1280, height: 1280 },
  portrait_4_3: { width: 1152, height: 1536 },
  portrait_16_9: { width: 1088, height: 1920 },
}

export type CreateContext = {
  env: { RUNWARE_KEY: string; PUBLIC_URL: string }
  services: {
    generations: Pick<GenerationService, 'create' | 'markSubmitted'>
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
  if (request.autoAspectRatio && input.positivePrompt && !input.width && !input.height) {
    const result = await ctx.services.autoAspectRatio(input.positivePrompt as string)

    if (result.ok) {
      const dims = ASPECT_RATIO_DIMENSIONS[result.value.aspectRatio]
      input.width = dims.width
      input.height = dims.height
    }

    // store result data
    providerMetadata = {
      ig_preprocessing: { autoAspectRatio: result },
    }
  }

  // Apply reasonable defaults
  input.taskType ??= 'imageInference'
  input.includeCost ??= true
  input.width ??= 1024
  input.height ??= 1024

  // Create record with metadata included
  const { id, slug } = await ctx.services.generations.create({
    provider: 'runware',
    model: request.model,
    input,
    tags: request.tags ?? [],
    slug: request.slug,
    providerMetadata,
  })

  // Submit to Runware API
  const webhookUrl = `${ctx.env.PUBLIC_URL}/webhooks/runware?generation_id=${id}`
  const response = await fetch(RUNWARE_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify([
      { taskType: 'authentication', apiKey: ctx.env.RUNWARE_KEY },
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

  console.log('generation_created', {
    id,
    slug,
    provider: 'runware',
    model: request.model,
    requestId: id,
  })
  return { id, slug, requestId: id }
}
