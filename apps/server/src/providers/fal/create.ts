/**
 * fal.ai generation creation
 *
 * Owns the complete generation flow for fal.ai provider.
 */

import { fal } from '@fal-ai/client'

import type { AutoAspectRatioResult, GenerationService } from '../../services'

export type CreateContext = {
  env: { FAL_KEY: string; PUBLIC_URL: string }
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

export async function create(ctx: CreateContext, request: CreateRequest) {
  const input = { ...request.input }
  let providerMetadata: Record<string, unknown> | undefined

  // Auto aspect ratio - fal accepts these values directly as image_size
  if (request.autoAspectRatio && input.prompt && !input.image_size) {
    const result = await ctx.services.autoAspectRatio(input.prompt as string)

    if (result.ok) {
      input.image_size = result.value.aspectRatio
    }

    // store result data
    providerMetadata = { ig_preprocessing: { autoAspectRatio: result } }
  }

  // Create record with metadata included
  const { id, slug } = await ctx.services.generations.create({
    provider: 'fal',
    model: request.model,
    input,
    tags: request.tags ?? [],
    slug: request.slug,
    providerMetadata,
  })

  // Submit to fal.ai queue
  const webhookUrl = `${ctx.env.PUBLIC_URL}/webhooks/fal?generation_id=${id}`
  fal.config({ credentials: ctx.env.FAL_KEY })
  const result = await fal.queue.submit(request.model, { input, webhookUrl })
  const requestId = result.request_id

  await ctx.services.generations.markSubmitted({ id, requestId })

  console.log('generation_created', {
    id,
    slug,
    provider: 'fal',
    model: request.model,
    requestId,
  })
  return { id, slug, requestId }
}
