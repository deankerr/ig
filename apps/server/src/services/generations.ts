import { generations } from "@ig/db/schema"
import { eq } from "drizzle-orm"
import type { DrizzleD1Database } from "drizzle-orm/d1"
import { v7 as uuidv7 } from "uuid"

import type * as schema from "@ig/db/schema"

const SLUG_PREFIX_LENGTH = 8

function makeSlug(id: string, slugArg?: string) {
  return slugArg ? `${id.slice(0, SLUG_PREFIX_LENGTH)}-${slugArg}` : null
}

export type GenerationService = ReturnType<typeof createGenerationService>

export function createGenerationService(db: DrizzleD1Database<typeof schema>) {
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
        status: "pending",
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
        { status: "failed", errorCode: args.error.code, errorMessage: args.error.message },
        args.providerMetadata,
      )
    },
  }
}
