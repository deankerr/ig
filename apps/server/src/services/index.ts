import * as schema from "@ig/db/schema"
import { drizzle } from "drizzle-orm/d1"

import { resolveAutoAspectRatio } from "./auto-aspect-ratio"
import { createGenerationService } from "./generations"

export function createServices(env: Env) {
  const db = drizzle(env.DB, { schema })

  return {
    generations: createGenerationService(db, env.GENERATIONS_BUCKET),
    autoAspectRatio: (prompt: string) => resolveAutoAspectRatio(prompt, env.AI),
  }
}

export type Services = ReturnType<typeof createServices>

export type { AspectRatio } from "./auto-aspect-ratio"
export type { GenerationService } from "./generations"
