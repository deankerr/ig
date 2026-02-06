import type { RouterClient } from "@orpc/server"

import { publicProcedure } from "../orpc"
import { generationsRouter } from "./generations"
import { modelsRouter } from "./models"
import { runwareRouter } from "./runware"

export const appRouter = {
  healthCheck: publicProcedure.handler(() => {
    return "OK"
  }),
  generations: generationsRouter,
  models: modelsRouter,
  runware: runwareRouter,
}
export type AppRouter = typeof appRouter
export type AppRouterClient = RouterClient<typeof appRouter>
