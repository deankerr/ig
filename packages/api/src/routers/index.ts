import type { RouterClient } from "@orpc/server"

import { publicProcedure } from "../index"
import { generationsRouter } from "./generations"
import { modelsRouter } from "./models"

export const appRouter = {
  healthCheck: publicProcedure.handler(() => {
    return "OK"
  }),
  generations: generationsRouter,
  models: modelsRouter,
}
export type AppRouter = typeof appRouter
export type AppRouterClient = RouterClient<typeof appRouter>
