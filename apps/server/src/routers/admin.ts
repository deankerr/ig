// Admin router — destructive operations requiring API key.

import { db } from '@ig/db'
import { runwareArtifacts, runwareGenerations, tags } from '@ig/db/schema'
import { eq, inArray } from 'drizzle-orm'
import { z } from 'zod'

import type { Context } from '../context'
import { getRequest } from '../inference/request'
import { apiKeyProcedure } from '../orpc'

export const adminRouter = {
  // Soft-delete: mark deletedAt, remove R2 blob + tags, keep D1 row
  deleteArtifact: apiKeyProcedure
    .input(z.object({ id: z.string() }))
    .handler(async ({ input, context }) => {
      const [artifact] = await db
        .select({ id: runwareArtifacts.id, r2Key: runwareArtifacts.r2Key })
        .from(runwareArtifacts)
        .where(eq(runwareArtifacts.id, input.id))
        .limit(1)

      if (!artifact) {
        console.log('[admin:deleteArtifact] not found', { id: input.id })
        return { id: input.id }
      }

      const now = new Date()

      // Soft-delete artifact row
      await db
        .update(runwareArtifacts)
        .set({ deletedAt: now })
        .where(eq(runwareArtifacts.id, input.id))

      // Delete R2 blob
      await context.env.GENERATIONS_BUCKET.delete(artifact.r2Key)

      // Delete tags
      await db.delete(tags).where(eq(tags.targetId, input.id))

      console.log('[admin:deleteArtifact]', { id: input.id })
      return { id: input.id }
    }),

  // Hard-delete: destroy generation + all artifacts + R2 blobs + tags + DO state
  deleteGeneration: apiKeyProcedure
    .input(z.object({ id: z.string() }))
    .handler(async ({ input, context }) => {
      // Fetch artifacts for R2 cleanup
      const artifacts = await db
        .select({ id: runwareArtifacts.id, r2Key: runwareArtifacts.r2Key })
        .from(runwareArtifacts)
        .where(eq(runwareArtifacts.generationId, input.id))

      const artifactIds = artifacts.map((a) => a.id)

      // Delete tags for all artifacts
      if (artifactIds.length > 0) {
        await db.delete(tags).where(inArray(tags.targetId, artifactIds))
      }

      // Delete R2 blobs
      for (const artifact of artifacts) {
        await context.env.GENERATIONS_BUCKET.delete(artifact.r2Key)
      }

      // Delete artifact rows
      await db.delete(runwareArtifacts).where(eq(runwareArtifacts.generationId, input.id))

      // Delete generation row
      await db.delete(runwareGenerations).where(eq(runwareGenerations.id, input.id))

      // Clear DO storage
      const ctx: Context = {
        env: context.env,
        headers: context.headers,
        waitUntil: context.waitUntil,
      }
      const request = getRequest(ctx, input.id)
      await request.destroy()

      console.log('[admin:deleteGeneration]', {
        id: input.id,
        artifacts: artifactIds.length,
      })
      return { id: input.id }
    }),
}
