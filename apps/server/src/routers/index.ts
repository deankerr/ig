import type { RouterClient } from "@orpc/server"

import { publicProcedure } from "../orpc"
import { generationsRouter } from "./generations"
import { modelsRouter } from "./models"
import { presetsRouter } from "./presets"

export const appRouter = {
  healthCheck: publicProcedure.handler(() => {
    return "OK"
  }),
  generations: generationsRouter,
  models: modelsRouter,
  presets: presetsRouter,
}
export type AppRouter = typeof appRouter
export type AppRouterClient = RouterClient<typeof appRouter>
