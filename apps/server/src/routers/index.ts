import type { RouterClient } from '@orpc/server'

import { procedure } from '../orpc'
import { artifactsRouter } from './artifacts'
import { generationsRouter } from './generations'
import { modelsRouter } from './models'

export const appRouter = {
  healthCheck: procedure.handler(() => {
    return 'OK'
  }),
  generations: generationsRouter,
  artifacts: artifactsRouter,
  models: modelsRouter,
}
export type AppRouter = typeof appRouter
export type AppRouterClient = RouterClient<typeof appRouter>
