// D1 progressive projection — fire-and-forget writes at each lifecycle transition.
// D1 failures are logged but never break the request flow. The DO remains source of truth.

import * as schema from '@ig/db/schema'
import type { NewRunwareGeneration } from '@ig/db/schema'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/d1'

import type { OutputSuccess } from './result'

/** INSERT generation row on submission (no completedAt). */
export async function insertGeneration(db: D1Database, args: NewRunwareGeneration) {
  const d1 = drizzle(db, { schema })
  try {
    await d1.insert(schema.runwareGenerations).values(args)
    console.log('[persist:insertGeneration]', { id: args.id })
  } catch (err) {
    console.error('[persist:insertGeneration] D1 write failed', {
      id: args.id,
      error: (err as { cause?: { message?: string } }).cause?.message ?? err,
    })
  }
}

type InsertArtifactArgs = {
  artifact: OutputSuccess
  generationId: string
  model: string
  input: Record<string, unknown>
  tags?: Record<string, string | null>
}

/** INSERT single artifact row + its tags after R2 store completes. */
export async function insertArtifact(db: D1Database, args: InsertArtifactArgs) {
  const { artifact, generationId, model, input, tags } = args
  const d1 = drizzle(db, { schema })

  // Extract dimensions from generation input
  const width = typeof input.width === 'number' ? input.width : undefined
  const height = typeof input.height === 'number' ? input.height : undefined

  try {
    await d1.insert(schema.runwareArtifacts).values({
      id: artifact.id,
      generationId,
      model,
      r2Key: artifact.r2Key,
      contentType: artifact.contentType,
      width,
      height,
      seed: artifact.seed,
      cost: artifact.cost,
      createdAt: artifact.createdAt,
    })

    // Persist tags for this artifact
    if (tags && Object.keys(tags).length > 0) {
      const tagRows = Object.entries(tags).map(([tag, value]) => ({
        tag,
        value,
        targetId: artifact.id,
      }))
      // D1 limit: 100 params per query, 3 columns per row → max 33 rows
      for (let i = 0; i < tagRows.length; i += 33) {
        await d1.insert(schema.tags).values(tagRows.slice(i, i + 33))
      }
    }

    console.log('[persist:insertArtifact]', { id: artifact.id, generationId })
  } catch (err) {
    console.error('[persist:insertArtifact] D1 write failed', {
      id: artifact.id,
      generationId,
      error: (err as { cause?: { message?: string } }).cause?.message ?? err,
    })
  }
}

type CompleteGenerationArgs = {
  id: string
  completedAt: Date
}

/** UPDATE generation with completedAt when all outputs are confirmed. */
export async function completeGeneration(db: D1Database, args: CompleteGenerationArgs) {
  const d1 = drizzle(db, { schema })
  try {
    await d1
      .update(schema.runwareGenerations)
      .set({ completedAt: args.completedAt })
      .where(eq(schema.runwareGenerations.id, args.id))
    console.log('[persist:completeGeneration]', { id: args.id })
  } catch (err) {
    console.error('[persist:completeGeneration] D1 write failed', {
      id: args.id,
      error: (err as { cause?: { message?: string } }).cause?.message ?? err,
    })
  }
}

type FailGenerationArgs = NewRunwareGeneration & { error: string; completedAt: Date }

/** UPDATE generation with error + completedAt on failure/timeout.
 *  Uses upsert so it's resilient if the initial INSERT was missed. */
export async function failGeneration(db: D1Database, args: FailGenerationArgs) {
  const d1 = drizzle(db, { schema })
  try {
    await d1
      .insert(schema.runwareGenerations)
      .values(args)
      .onConflictDoUpdate({
        target: schema.runwareGenerations.id,
        set: {
          error: args.error,
          completedAt: args.completedAt,
        },
      })
    console.log('[persist:failGeneration]', { id: args.id, error: args.error })
  } catch (err) {
    console.error('[persist:failGeneration] D1 write failed', {
      id: args.id,
      error: (err as { cause?: { message?: string } }).cause?.message ?? err,
    })
  }
}
