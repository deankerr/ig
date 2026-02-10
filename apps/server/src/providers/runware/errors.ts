import { serializeError, type SerializedError } from '../../utils/error'
import type { RunwareError } from './schemas'

// -- Shared error shape for HTTP/fetch failures --

export type HttpError = {
  code: 'http_error' | 'fetch_failed'
  url: string
  status: number
  body: string
}

// -- Generation-level errors --

type ApiRejection = { code: 'api_rejected'; errors: RunwareError[] }
type TimeoutError = { code: 'timeout'; received: number; expected: number }
type ProjectionError = { code: 'projection_failed'; cause: SerializedError }

export type GenerationError = HttpError | ApiRejection | TimeoutError | ProjectionError

// -- Output-level errors --

type FlatError = { formErrors: string[]; fieldErrors: Record<string, string[] | undefined> }
type ValidationError = { code: 'validation'; issues: FlatError }
type WebhookError = { code: 'webhook_error'; errors: RunwareError[] }
type StorageError = { code: 'storage_failed'; r2Key: string; cause: SerializedError }

export type OutputErrorDetail = ValidationError | WebhookError | HttpError | StorageError

// -- Generation-level factories (produce raw error details for meta.error) --

export function httpError(
  code: HttpError['code'],
  url: string,
  status: number,
  body: string,
): HttpError {
  return { code, url, status, body }
}

export function timeoutError(received: number, expected: number): TimeoutError {
  return { code: 'timeout', received, expected }
}

export function projectionError(cause: unknown): ProjectionError {
  return { code: 'projection_failed', cause: serializeError(cause) }
}

// -- Output-level factories (produce full { type, error, raw, createdAt } objects) --

export function validationError(issues: FlatError, raw: unknown, createdAt: number) {
  return { type: 'error' as const, error: { code: 'validation' as const, issues }, raw, createdAt }
}

export function webhookError(errors: RunwareError[], raw: unknown, createdAt: number) {
  return {
    type: 'error' as const,
    error: { code: 'webhook_error' as const, errors },
    raw,
    createdAt,
  }
}

export function fetchError(
  url: string,
  status: number,
  body: string,
  raw: unknown,
  createdAt: number,
) {
  return {
    type: 'error' as const,
    error: httpError('fetch_failed', url, status, body),
    raw,
    createdAt,
  }
}

export function storageError(r2Key: string, cause: unknown, raw: unknown, createdAt: number) {
  return {
    type: 'error' as const,
    error: { code: 'storage_failed' as const, r2Key, cause: serializeError(cause) },
    raw,
    createdAt,
  }
}
