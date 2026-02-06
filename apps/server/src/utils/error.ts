/**
 * Error utilities for serialization and framework error handlers.
 */

import { ORPCError } from "@orpc/server"

type SerializedError = Record<string, unknown>

/**
 * Extract a message from any error value.
 */
export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/**
 * Serialize any error to a plain object for storage/logging.
 * Preserves cause chain and any custom properties.
 */
export function serializeError(error: unknown): SerializedError {
  if (!Error.isError(error)) {
    return { message: String(error) }
  }

  const serialized: SerializedError = {
    name: error.name,
    message: error.message,
  }

  for (const key of Object.keys(error)) {
    if (key === "cause") continue
    const value = (error as unknown as Record<string, unknown>)[key]
    if (typeof value === "function" || typeof value === "symbol") continue
    serialized[key] = value
  }

  if (error.cause !== undefined) {
    serialized.cause = Error.isError(error.cause) ? serializeError(error.cause) : error.cause
  }

  return serialized
}

/**
 * Find the most useful message from a serialized error.
 * Prefers D1 error messages when present.
 */
function extractMessage(serialized: SerializedError): string {
  let current: SerializedError | undefined = serialized
  while (current) {
    const message = current.message
    if (typeof message === "string" && message.startsWith("D1_ERROR")) {
      return message
    }
    current = current.cause as SerializedError | undefined
  }

  if (typeof serialized.message === "string") {
    return serialized.message
  }

  return "Unknown error"
}

/**
 * Serialize and log an error, returning the response payload.
 */
function toErrorResponse(error: unknown) {
  const serialized = serializeError(error)
  const message = extractMessage(serialized)

  console.error("request_error", serialized)

  return { message, error: serialized }
}

/**
 * oRPC error handler.
 * Logs the error and throws an ORPCError for the response.
 */
export function handleOrpcError(error: unknown): never {
  const { message, error: serialized } = toErrorResponse(error)

  throw new ORPCError("BAD_REQUEST", {
    message,
    data: { error: serialized },
  })
}

/**
 * Hono error handler.
 * Returns a JSON response with the same shape as oRPC errors.
 */
export function handleHonoError(error: unknown) {
  const { message, error: serialized } = toErrorResponse(error)

  return {
    status: 400 as const,
    body: { message, error: serialized },
  }
}
