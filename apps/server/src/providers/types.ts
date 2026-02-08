/**
 * Shared types for provider webhook resolution.
 */

import type { Result } from '../utils/result'

/**
 * A single resolved output from a provider.
 */
export type ResolvedOutput = Result<
  { data: ArrayBuffer | Uint8Array; contentType: string; metadata?: Record<string, unknown> },
  { code: string }
>

/**
 * Result of resolving a provider webhook payload.
 */
export type ProviderResult = Result<
  { outputs: ResolvedOutput[]; requestId?: string; metadata?: Record<string, unknown> },
  { code: string }
>
