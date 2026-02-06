/**
 * Error logging utilities for D1/Drizzle errors
 *
 * D1 errors wrap SQLite errors in a .cause property. This module
 * ensures we log the full error chain for debugging.
 */

type ErrorWithCause = Error & {
  cause?: ErrorWithCause
  code?: string
}

/**
 * Extract the root cause from a potentially nested error
 */
function getRootCause(error: unknown): ErrorWithCause | undefined {
  if (!error || typeof error !== "object") return undefined

  const err = error as ErrorWithCause
  if (err.cause && typeof err.cause === "object") {
    return getRootCause(err.cause) ?? (err.cause as ErrorWithCause)
  }
  return undefined
}

/**
 * Log an error with its full cause chain
 * Suitable for use as an oRPC onError interceptor
 */
export function logError(error: unknown): void {
  const rootCause = getRootCause(error)

  if (rootCause) {
    // Log structured error with cause details
    console.error("request_error", {
      message: error instanceof Error ? error.message : String(error),
      cause: rootCause.message,
      code: rootCause.code,
    })
  } else {
    // Fallback to standard error logging
    console.error(error)
  }
}
