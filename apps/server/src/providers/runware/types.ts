import type { GenerationError, OutputErrorDetail } from './errors'
import type { ImageInferenceInput } from './schemas'

// -- Output types --

export type OutputSuccess = {
  type: 'success'
  id: string
  r2Key: string
  contentType: string
  seed: number
  cost?: number
  metadata: Record<string, unknown>
  createdAt: number
}

export type OutputError = {
  type: 'error'
  error: OutputErrorDetail
  raw: unknown
  createdAt: number
}

export type Output = OutputSuccess | OutputError

// -- DO state --

export type GenerationMeta = {
  id: string
  model: string
  input: Record<string, unknown>
  outputFormat: ImageInferenceInput['outputFormat']
  expectedCount: number
  annotations: Record<string, unknown>
  error?: GenerationError
  createdAt: number
  completedAt?: number
}

export type GenerationState = GenerationMeta & {
  outputs: Output[]
}

// -- RPC argument/return types --

export type InitArgs = {
  id: string
  model: string
  input: Record<string, unknown>
  outputFormat: ImageInferenceInput['outputFormat']
  expectedCount: number
  annotations: Record<string, unknown>
  error?: GenerationError
}

export type PendingItem = {
  index: number
  imageURL: string
  seed: number
  cost?: number
  raw: Record<string, unknown>
}

export type RecordWebhookResult = {
  items: PendingItem[]
  meta: GenerationMeta
}

export type OutputResult = OutputSuccess | OutputError

export type ConfirmResult = {
  complete: boolean
}
