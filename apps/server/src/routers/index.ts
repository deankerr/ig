import type { RouterClient } from '@orpc/server'

import { publicProcedure } from '../orpc'
import { artifactsRouter } from './artifacts'
import { generationsRouter } from './generations'
import { modelsRouter } from './models'

export const appRouter = {
  healthCheck: publicProcedure.handler(() => {
    return 'OK'
  }),
  generations: generationsRouter,
  artifacts: artifactsRouter,
  models: modelsRouter,
}
export type AppRouter = typeof appRouter
export type AppRouterClient = RouterClient<typeof appRouter>
