import type { RouterClient } from '@orpc/server'

import { publicProcedure } from '../orpc'
import { runwareRouter } from './runware'

export const appRouter = {
  healthCheck: publicProcedure.handler(() => {
    return 'OK'
  }),
  runware: runwareRouter,
}
export type AppRouter = typeof appRouter
export type AppRouterClient = RouterClient<typeof appRouter>
