// Models router — search available models.

import { z } from 'zod'

import { searchModels } from '../models'
import { publicProcedure } from '../orpc'

export const modelsRouter = {
  search: publicProcedure
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
