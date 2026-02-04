/**
 * Shared types for provider webhook resolution.
 */

/**
 * A single resolved output from a provider.
 * Either successfully resolved data or an error.
 */
export type ResolvedOutput =
  | {
      ok: true
      data: ArrayBuffer | Uint8Array
      contentType: string
      metadata?: Record<string, unknown>
    }
  | { ok: false; code: string; message: string }

/**
 * Result of resolving a provider webhook payload.
 * Either a successful resolution with outputs, or a top-level failure.
 */
export type ProviderResult =
  | { ok: true; outputs: ResolvedOutput[]; requestId?: string; metadata?: Record<string, unknown> }
  | { ok: false; code: string; message: string }
