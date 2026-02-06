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
export function serializeError(error: unknown): Record<string, unknown> {
  if (!Error.isError(error)) {
    return { message: String(error) }
  }

  const serialized: Record<string, unknown> = {
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
