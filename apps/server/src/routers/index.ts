import type { RouterClient } from '@orpc/server'

import { publicProcedure } from '../orpc'
import { inferenceRouter } from './inference'

export const appRouter = {
  healthCheck: publicProcedure.handler(() => {
    return 'OK'
  }),
  inference: inferenceRouter,
}
export type AppRouter = typeof appRouter
export type AppRouterClient = RouterClient<typeof appRouter>
