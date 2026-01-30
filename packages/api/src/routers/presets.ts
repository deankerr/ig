import { db } from "@ig/db"
import { presets } from "@ig/db/schema"
import { eq } from "drizzle-orm"
import { z } from "zod"

import { apiKeyProcedure, publicProcedure } from "../index"

const PRESET_PREFIX = "ig/"

const presetNameSchema = z
  .string()
  .min(4) // at least "ig/x"
  .max(100)
  .startsWith(PRESET_PREFIX, `Preset name must start with "${PRESET_PREFIX}"`)

export const presetsRouter = {
  create: apiKeyProcedure
    .input(
      z.object({
        name: presetNameSchema,
        description: z.string().max(500).optional(),
        model: z.string().min(1),
        input: z.record(z.string(), z.unknown()).optional(),
        tags: z.array(z.string()).optional(),
      }),
    )
    .handler(async ({ input }) => {
      const now = new Date()
      await db
        .insert(presets)
        .values({
          name: input.name,
          description: input.description,
          model: input.model,
          input: input.input,
          tags: input.tags,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: presets.name,
          set: {
            description: input.description,
            model: input.model,
            input: input.input,
            tags: input.tags,
            updatedAt: now,
          },
        })

      return { name: input.name }
    }),

  get: publicProcedure
    .route({ spec: { security: [] } })
    .input(z.object({ name: presetNameSchema }))
    .handler(async ({ input }) => {
      const result = await db.select().from(presets).where(eq(presets.name, input.name)).limit(1)

      if (result.length === 0) {
        return null
      }

      return result[0]
    }),

  list: publicProcedure.route({ spec: { security: [] } }).handler(async () => {
    const result = await db.select().from(presets)
    return { items: result }
  }),

  delete: apiKeyProcedure.input(z.object({ name: presetNameSchema })).handler(async ({ input }) => {
    await db.delete(presets).where(eq(presets.name, input.name))
    return { deleted: true }
  }),
}
