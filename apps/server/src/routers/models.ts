// Models router — search and lookup available models.

import { z } from 'zod'

import { procedure } from '../orpc'
import { lookupModel, searchModels } from '../services/models'

export const modelsRouter = {
  // Single model lookup by AIR (KV cache → Runware API fallback)
  get: procedure.input(z.object({ air: z.string() })).handler(async ({ input, context }) => {
    return lookupModel(context, input.air)
  }),

  search: procedure
    .input(
      z.object({
        search: z.string().optional(),
        tags: z.array(z.string()).optional(),
        architecture: z.string().optional(),
        conditioning: z.string().optional(),
        limit: z.number().int().min(1).max(100).optional(),
        offset: z.number().int().min(0).optional(),
      }),
    )
    .handler(async ({ input, context }) => {
      return searchModels(context, { ...input, category: 'checkpoint', type: 'base' })
    }),
}
