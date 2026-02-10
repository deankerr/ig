import { v7 as uuidv7 } from 'uuid'
import { z } from 'zod'

import { apiKeyProcedure, publicProcedure } from '../orpc'
import { searchModels } from '../providers/runware/model-search'
import { imageInferenceInput, type ImageInferenceInput } from '../providers/runware/schemas'

// Extracted to avoid circular type depth: Env → DO<GenerationDO> → Rpc → Env
async function dispatchGeneration(env: Env, id: string, input: ImageInferenceInput) {
  // biome-ignore lint: env type cast needed to break circular depth
  const ns = (env as any).GENERATION_DO
  const stub = ns.get(ns.idFromName(id))
  await stub.create({ id, ...input })
}

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
    const id = uuidv7()
    await dispatchGeneration(context.env, id, input.input)
    return { id }
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
      return searchModels(context.env.RUNWARE_KEY, input)
    }),
}
