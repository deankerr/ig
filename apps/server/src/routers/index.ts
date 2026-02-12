import type { RouterClient } from '@orpc/server'

import { publicProcedure } from '../orpc'
import { browseRouter } from './browse'
import { inferenceRouter } from './inference'
import { tagsRouter } from './tags'

export const appRouter = {
  healthCheck: publicProcedure.handler(() => {
    return 'OK'
  }),
  inference: inferenceRouter,
  browse: browseRouter,
  tags: tagsRouter,
}
export type AppRouter = typeof appRouter
export type AppRouterClient = RouterClient<typeof appRouter>
