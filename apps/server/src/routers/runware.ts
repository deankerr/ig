import { z } from 'zod'

import { apiKeyProcedure, publicProcedure } from '../orpc'
import { createGeneration } from '../providers/runware/create'
import { searchModels } from '../providers/runware/model-search'
import { imageInferenceInput } from '../providers/runware/schemas'
import { getGenerationStub } from '../providers/runware/stub'

const MAX_TAGS = 20
const tagSchema = z.string().trim().max(256, 'Tag cannot exceed 256 characters')
const tagsSchema = z
  .array(tagSchema)
  .transform((tags) => [...new Set(tags.filter(Boolean))])
  .refine((tags) => tags.length <= MAX_TAGS, `Cannot exceed ${MAX_TAGS} tags`)

const createImageSchema = z.object({
  input: imageInferenceInput,
  tags: tagsSchema.optional().default([]),
})

export const runwareRouter = {
  createImage: apiKeyProcedure.input(createImageSchema).handler(async ({ input, context }) => {
    const id = await createGeneration(context, { input: input.input })
    return { id }
  }),

  getStatus: publicProcedure
    .route({ spec: { security: [] } })
    .input(z.object({ id: z.uuid() }))
    .handler(async ({ input, context }) => {
      const stub = getGenerationStub(context, input.id)
      return stub.getState()
    }),

  searchModels: publicProcedure
    .route({ spec: { security: [] } })
    .input(
      z.object({
        search: z.string().optional(),
        tags: z.array(z.string()).optional(),
        category: z.string().optional(),
        type: z.string().optional(),
        architecture: z.string().optional(),
        conditioning: z.string().optional(),
        visibility: z.string().optional(),
        limit: z.number().int().min(1).max(100).optional(),
        offset: z.number().int().min(0).optional(),
      }),
    )
    .handler(async ({ input, context }) => {
      return searchModels(context, input)
    }),
}
