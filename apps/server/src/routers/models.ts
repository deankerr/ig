import { db } from "@ig/db"
import { models } from "@ig/db/schema"
import { asc, desc, eq, like, or, sql } from "drizzle-orm"
import { z } from "zod"

import { apiKeyProcedure, publicProcedure } from "../orpc"

// Fixed workflow instance IDs
const WORKFLOW_IDS = {
  STANDARD: "model-sync",
  ALL: "model-sync-all",
} as const

export const modelsRouter = {
  list: publicProcedure
    .route({ spec: { security: [] } })
    .input(
      z.object({
        category: z.string().optional(),
        kind: z.string().optional(),
        status: z.string().optional(),
        search: z.string().optional(),
        limit: z.number().int().min(1).max(100).optional().default(50),
        offset: z.number().int().min(0).optional().default(0),
      }),
    )
    .handler(async ({ input }) => {
      const conditions = []

      if (input.category) {
        conditions.push(eq(models.category, input.category))
      }

      if (input.kind) {
        conditions.push(eq(models.kind, input.kind))
      }

      if (input.status) {
        conditions.push(eq(models.status, input.status))
      }

      if (input.search) {
        const searchPattern = `%${input.search}%`
        conditions.push(
          or(like(models.displayName, searchPattern), like(models.endpointId, searchPattern)),
        )
      }

      const whereClause =
        conditions.length > 0
          ? sql`${conditions.reduce((acc, cond, i) => (i === 0 ? cond : sql`${acc} AND ${cond}`))}`
          : undefined

      // Fetch one extra to check if there are more pages
      const results = await db
        .select()
        .from(models)
        .where(whereClause)
        .orderBy(desc(models.upstreamCreatedAt))
        .limit(input.limit + 1)
        .offset(input.offset)

      const hasMore = results.length > input.limit
      const items = hasMore ? results.slice(0, input.limit) : results

      return {
        items,
        hasMore,
      }
    }),

  get: publicProcedure
    .route({ spec: { security: [] } })
    .input(z.object({ endpointId: z.string().min(1) }))
    .handler(async ({ input }) => {
      const result = await db
        .select()
        .from(models)
        .where(eq(models.endpointId, input.endpointId))
        .limit(1)

      if (result.length === 0) {
        return null
      }

      return result[0]
    }),

  listCategories: publicProcedure.route({ spec: { security: [] } }).handler(async () => {
    const results = await db
      .selectDistinct({ category: models.category })
      .from(models)
      .orderBy(asc(models.category))

    return { categories: results.map((r) => r.category) }
  }),

  startSync: apiKeyProcedure
    .input(
      z
        .object({
          all: z.boolean().optional(),
        })
        .optional(),
    )
    .handler(async ({ input, context }) => {
      const workflow = context.env.MODEL_SYNC_WORKFLOW
      const mode = input?.all ? "all" : "standard"
      const instanceId = mode === "all" ? WORKFLOW_IDS.ALL : WORKFLOW_IDS.STANDARD
      const params = mode === "all" ? { stalePricingDays: 0 } : {}

      // Check if any sync is currently running
      for (const id of [WORKFLOW_IDS.STANDARD, WORKFLOW_IDS.ALL]) {
        try {
          const instance = await workflow.get(id)
          const { status } = await instance.status()
          if (status === "running" || status === "queued" || status === "waiting") {
            return { started: false, instanceId: id, reason: "sync in progress" }
          }
        } catch {
          // Instance doesn't exist, continue checking
        }
      }

      // Create or restart the workflow
      try {
        await workflow.create({ id: instanceId, params })
      } catch {
        // Instance already exists, restart it
        const instance = await workflow.get(instanceId)
        await instance.restart()
      }

      return { started: true, instanceId }
    }),

  getSyncStatus: publicProcedure.route({ spec: { security: [] } }).handler(async ({ context }) => {
    const workflow = context.env.MODEL_SYNC_WORKFLOW

    async function getStatus(id: string): Promise<string | null> {
      try {
        const instance = await workflow.get(id)
        const { status } = await instance.status()
        return status
      } catch {
        return null
      }
    }

    return {
      standard: await getStatus(WORKFLOW_IDS.STANDARD),
      all: await getStatus(WORKFLOW_IDS.ALL),
    }
  }),
}
