import { serializeError, type SerializedError } from '../utils/error'
import type { RunwareError } from './schema'

// -- Request-level errors --

type HttpError = { code: 'http_error'; url: string; status: number; body: string }
type ApiRejection = { code: 'api_rejected'; errors: RunwareError[] }
type TimeoutError = { code: 'timeout'; received: number; expected: number }
type ProjectionError = { code: 'projection_failed'; cause: SerializedError }

export type RequestError = HttpError | ApiRejection | TimeoutError | ProjectionError

export function httpError(url: string, status: number, body: string): HttpError {
  return { code: 'http_error', url, status, body }
}

export function timeoutError(received: number, expected: number): TimeoutError {
  return { code: 'timeout', received, expected }
}

export function projectionError(cause: unknown): ProjectionError {
  return { code: 'projection_failed', cause: serializeError(cause) }
}

// -- Output types --

type FlatError = { formErrors: string[]; fieldErrors: Record<string, string[] | undefined> }
type ValidationError = { code: 'validation'; issues: FlatError }
type WebhookError = { code: 'webhook_error'; errors: RunwareError[] }
type FetchError = { code: 'fetch_failed'; url: string; status: number; body: string }
type StorageError = { code: 'storage_failed'; r2Key: string; cause: SerializedError }

type OutputErrorDetail = ValidationError | WebhookError | FetchError | StorageError

export type OutputSuccess = {
  type: 'success'
  id: string
  r2Key: string
  contentType: string
  seed: number
  cost?: number
  createdAt: Date
}

export type OutputError = {
  type: 'error'
  error: OutputErrorDetail
  raw: unknown
  createdAt: Date
}

export type Output = OutputSuccess | OutputError

// -- Output factories --

export const output = {
  success(args: Omit<OutputSuccess, 'type'>): OutputSuccess {
    return { type: 'success', ...args }
  },

  validationError(issues: FlatError, raw: unknown, createdAt: Date): OutputError {
    return { type: 'error', error: { code: 'validation', issues }, raw, createdAt }
  },

  webhookError(errors: RunwareError[], raw: unknown, createdAt: Date): OutputError {
    return { type: 'error', error: { code: 'webhook_error', errors }, raw, createdAt }
  },

  fetchError(
    url: string,
    status: number,
    body: string,
    raw: unknown,
    createdAt: Date,
  ): OutputError {
    return { type: 'error', error: { code: 'fetch_failed', url, status, body }, raw, createdAt }
  },

  storageError(r2Key: string, cause: unknown, raw: unknown, createdAt: Date): OutputError {
    return {
      type: 'error',
      error: { code: 'storage_failed', r2Key, cause: serializeError(cause) },
      raw,
      createdAt,
    }
  },
}
