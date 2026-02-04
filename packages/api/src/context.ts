/**
 * Context type expected by the API procedures.
 *
 * This is a structural type that defines what the API layer expects from the context.
 * The actual context is created in apps/server/src/context.ts.
 */

type AspectRatio = "landscape_16_9" | "landscape_4_3" | "square" | "portrait_4_3" | "portrait_16_9"

type AutoAspectRatioResult =
  | {
      ok: true
      data: { aspectRatio: AspectRatio; reasoning: string; model: string }
      error: undefined
    }
  | {
      ok: false
      data: undefined
      error: { error: Record<string, unknown>; model: string }
    }

type GenerationService = {
  create(args: {
    provider: string
    model: string
    input: Record<string, unknown>
    tags: string[]
    slug?: string
    providerMetadata?: Record<string, unknown>
  }): Promise<{ id: string; slug: string | null }>
  markSubmitted(args: {
    id: string
    requestId: string
    providerMetadata?: Record<string, unknown>
  }): Promise<void>
}

export type Context = {
  env: Env
  headers: Headers
  services: {
    generations: GenerationService
    autoAspectRatio: (prompt: string) => Promise<AutoAspectRatioResult>
  }
}
