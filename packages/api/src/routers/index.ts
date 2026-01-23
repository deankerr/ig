import type { RouterClient } from "@orpc/server"

import { publicProcedure } from "../index"
import { generationsRouter } from "./generations"

export const appRouter = {
  healthCheck: publicProcedure.handler(() => {
    return "OK"
  }),
  generations: generationsRouter,
}
export type AppRouter = typeof appRouter
export type AppRouterClient = RouterClient<typeof appRouter>
