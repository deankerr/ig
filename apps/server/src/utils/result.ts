/**
 * Simple success/failure union for operations that can fail.
 *
 * - Success: { ok: true, value: T }
 * - Failure: { ok: false, message: string, error?: E }
 *
 * The failure `error` carries context for debugging without losing it.
 */
export type Result<T, E = unknown> =
  | { ok: true; value: T }
  | { ok: false; message: string; error?: E }
