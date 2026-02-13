import { z } from 'zod'

import { getRequest } from '../inference/request'
import { imageInferenceInput } from '../inference/schema'
import { submitRequest } from '../inference/submit'
import { searchModels } from '../models'
import { apiKeyProcedure, publicProcedure } from '../orpc'

const MAX_TAGS = 20
const MAX_KEY_LENGTH = 64
const MAX_VALUE_LENGTH = 256

const tagsSchema = z
  .record(z.string().trim().min(1).max(MAX_KEY_LENGTH), z.string().max(MAX_VALUE_LENGTH).nullable())
  .refine((tags) => Object.keys(tags).length <= MAX_TAGS, `Cannot exceed ${MAX_TAGS} tags`)

// Flat input: inference fields + ig extensions (tags, sync, etc.) at the same level
const createImageSchema = imageInferenceInput.extend({
  tags: tagsSchema.optional(),
  sync: z.boolean().optional().default(false),
})

export const inferenceRouter = {
  createImage: apiKeyProcedure.input(createImageSchema).handler(async ({ input, context }) => {
    const { tags, sync, ...inferenceInput } = input
    return submitRequest(context, { input: inferenceInput, tags, sync })
  }),

  getStatus: publicProcedure
    .route({ spec: { security: [] } })
    .input(z.object({ id: z.uuid() }))
    .handler(async ({ input, context }) => {
      const request = getRequest(context, input.id)
      return request.getState()
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
