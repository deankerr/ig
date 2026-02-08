import { generations } from '@ig/db/schema'
import type * as schema from '@ig/db/schema'
import { eq } from 'drizzle-orm'
import type { DrizzleD1Database } from 'drizzle-orm/d1'
import { v7 as uuidv7 } from 'uuid'

import type { ProviderResult } from '../providers/types'

const SLUG_PREFIX_LENGTH = 12

function makeSlug(id: string, slugArg?: string) {
  return slugArg ? `${id.slice(0, SLUG_PREFIX_LENGTH)}-${slugArg}` : null
}

export type GenerationService = ReturnType<typeof createGenerationService>

export function createGenerationService(db: DrizzleD1Database<typeof schema>, bucket: R2Bucket) {
  // Internal helper - handles optional providerMetadata merge in one place
  async function updateWithMetadata(
    id: string,
    set: Partial<typeof generations.$inferInsert>,
    providerMetadata?: Record<string, unknown>,
  ) {
    let values = set
    if (providerMetadata) {
      const [existing] = await db
        .select({ providerMetadata: generations.providerMetadata })
        .from(generations)
        .where(eq(generations.id, id))
        .limit(1)

      values = { ...set, providerMetadata: { ...existing?.providerMetadata, ...providerMetadata } }
    }

    await db.update(generations).set(values).where(eq(generations.id, id))
  }

  return {
    async create(args: {
      provider: string
      model: string
      input: Record<string, unknown>
      tags: string[]
      slug?: string
      providerMetadata?: Record<string, unknown>
    }) {
      const id = uuidv7()
      const slug = makeSlug(id, args.slug)

      await db.insert(generations).values({
        id,
        status: 'pending',
        provider: args.provider,
        model: args.model,
        input: args.input,
        tags: args.tags,
        slug,
        providerMetadata: args.providerMetadata,
      })
      return { id, slug }
    },

    async markSubmitted(args: {
      id: string
      requestId: string
      providerMetadata?: Record<string, unknown>
    }) {
      await updateWithMetadata(
        args.id,
        { providerRequestId: args.requestId },
        args.providerMetadata,
      )
    },

    async get(args: { id: string }) {
      const [generation] = await db
        .select()
        .from(generations)
        .where(eq(generations.id, args.id))
        .limit(1)
      return generation ?? null
    },

    async fail(args: {
      id: string
      error: { code: string; message: string }
      providerMetadata?: Record<string, unknown>
    }) {
      await updateWithMetadata(
        args.id,
        {
          status: 'failed',
          errorCode: args.error.code,
          errorMessage: args.error.message,
          completedAt: new Date(),
        },
        args.providerMetadata,
      )
    },

    /**
     * Complete a generation with resolved provider outputs.
     * Handles R2 storage and batch record creation.
     */
    async complete(args: { id: string; provider: string; result: ProviderResult }) {
      const { result } = args

      // Handle top-level failure
      if (!result.ok) {
        await this.fail({
          id: args.id,
          error: { code: result.error?.code ?? 'UNKNOWN', message: result.message },
        })
        console.log('generation_failed', { generationId: args.id, code: result.error?.code })
        return
      }

      const { outputs, requestId, metadata: resultMetadata } = result.value

      const generation = await this.get({ id: args.id })
      if (!generation) {
        throw new Error(`Generation not found: ${args.id}`)
      }

      const batchTag = outputs.length > 1 ? `batch:${args.id}` : null

      for (let i = 0; i < outputs.length; i++) {
        const output = outputs[i]
        if (!output) continue

        const isFirst = i === 0
        const genId = isFirst ? args.id : uuidv7()

        // Merge metadata (used for both success and failure)
        const mergedMetadata = {
          ...generation.providerMetadata,
          ...resultMetadata,
        }

        // Handle per-output failure
        if (!output.ok) {
          const code = output.error?.code ?? 'UNKNOWN'
          if (isFirst) {
            // Update original generation to failed
            await db
              .update(generations)
              .set({
                status: 'failed',
                errorCode: code,
                errorMessage: output.message,
                completedAt: new Date(),
                providerRequestId: requestId,
                providerMetadata: mergedMetadata,
              })
              .where(eq(generations.id, genId))
          } else {
            // Create failed record for batch output
            await db.insert(generations).values({
              id: genId,
              status: 'failed',
              provider: args.provider,
              model: generation.model,
              input: generation.input,
              tags: batchTag ? [...generation.tags, batchTag] : generation.tags,
              errorCode: code,
              errorMessage: output.message,
              providerRequestId: requestId,
              providerMetadata: mergedMetadata,
              createdAt: generation.createdAt,
              completedAt: new Date(),
            })
          }

          console.log('generation_output_failed', {
            generationId: genId,
            code,
            batch: !isFirst,
          })
          continue
        }

        const { data, contentType, metadata: outputMeta } = output.value

        // Store to R2
        const r2Key = `generations/${genId}`
        await bucket.put(r2Key, data, {
          httpMetadata: { contentType },
        })

        // Add per-output metadata
        const outputMetadata = { ...mergedMetadata, ...outputMeta }

        if (isFirst) {
          // Update the original generation
          await db
            .update(generations)
            .set({
              status: 'ready',
              contentType,
              completedAt: new Date(),
              providerRequestId: requestId,
              providerMetadata: outputMetadata,
            })
            .where(eq(generations.id, genId))
        } else {
          // Create new generation record for batch outputs
          await db.insert(generations).values({
            id: genId,
            status: 'ready',
            provider: args.provider,
            model: generation.model,
            input: generation.input,
            tags: batchTag ? [...generation.tags, batchTag] : generation.tags,
            contentType,
            providerRequestId: requestId,
            providerMetadata: outputMetadata,
            createdAt: generation.createdAt,
            completedAt: new Date(),
          })
        }

        console.log('generation_ready', {
          generationId: genId,
          contentType,
          batch: !isFirst,
        })
      }
    },
  }
}
