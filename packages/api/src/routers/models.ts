import { db } from "@ig/db"
import { models } from "@ig/db/schema"
import { asc, eq, like, or, sql } from "drizzle-orm"
import { apiKeyProcedure, publicProcedure } from "../index"
import { getModelInputSchema, listModelsInputSchema } from "../schemas/models"
import { getSyncStatus, startModelSync } from "../services/model-sync"

export const modelsRouter = {
  list: publicProcedure.input(listModelsInputSchema).handler(async ({ input }) => {
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

    const results = await db
      .select()
      .from(models)
      .where(whereClause)
      .orderBy(asc(models.displayName))
      .limit(input.limit)
      .offset(input.offset)

    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(models)
      .where(whereClause)

    return {
      items: results,
      total: countResult[0]?.count ?? 0,
      limit: input.limit,
      offset: input.offset,
    }
  }),

  get: publicProcedure.input(getModelInputSchema).handler(async ({ input }) => {
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

  listCategories: publicProcedure.handler(async () => {
    const results = await db
      .selectDistinct({ category: models.category })
      .from(models)
      .orderBy(asc(models.category))

    return { categories: results.map((r) => r.category) }
  }),

  // Start a new sync - fast operation that enqueues pricing fetches
  startSync: apiKeyProcedure.handler(async ({ context }) => {
    const result = await startModelSync({
      falKey: context.env.FAL_KEY,
      queue: context.env.MODEL_SYNC_QUEUE,
    })
    return result
  }),

  // Get current sync status
  getSyncStatus: publicProcedure.handler(async () => {
    return getSyncStatus()
  }),

  // Get all models for client-side table (no pagination)
  listAll: publicProcedure.handler(async () => {
    const results = await db.select().from(models).orderBy(asc(models.displayName))

    return {
      items: results,
      fetchedAt: Date.now(),
    }
  }),
}
