/**
 * Type definitions for Generation Manager Durable Object
 */

/**
 * Generation status lifecycle
 */
export type GenerationStatus = "pending" | "submitted" | "processing" | "ready" | "failed"

/**
 * Execution strategy for generation
 */
export type ExecutionStrategy = "webhook" | "sync" | "websocket" | "poll"

/**
 * Provider-agnostic output result
 */
export interface ResolvedOutput {
  ok: true
  data: ArrayBuffer
  contentType: string
  metadata?: Record<string, unknown>
}

export interface FailedOutput {
  ok: false
  code: string
  message: string
}

export type OutputResult = ResolvedOutput | FailedOutput

/**
 * Core generation state persisted in DO storage
 */
export interface GenerationState {
  // Identity
  id: string
  provider: "fal" | "runware"
  model: string
  slug: string | null

  // Request
  input: Record<string, unknown>
  tags: string[]

  // Status
  status: GenerationStatus
  errorCode?: string
  errorMessage?: string

  // Result tracking for batch aggregation
  expectedCount: number
  receivedCount: number
  outputs: OutputResult[]

  // Execution context
  strategy: ExecutionStrategy
  providerRequestId?: string
  providerMetadata?: Record<string, unknown>

  // Timestamps
  createdAt: number
  submittedAt?: number
  completedAt?: number
}

/**
 * WebSocket events sent to connected clients
 */
export type WSClientEvent =
  | { type: "connected"; generationId: string }
  | { type: "status"; status: GenerationStatus; generationId: string }
  | { type: "progress"; received: number; expected: number; generationId: string }
  | {
      type: "result"
      index: number
      contentType: string
      generationId: string
      // Note: binary data sent separately or as base64
    }
  | { type: "complete"; outputCount: number; generationId: string }
  | { type: "error"; code: string; message: string; generationId: string }
  | { type: "ping" }

/**
 * WebSocket messages from clients
 */
export type WSClientMessage =
  | { type: "subscribe" }
  | { type: "ping" }
  | { type: "pong" }

/**
 * Request to create a new generation
 */
export interface CreateGenerationRequest {
  provider: "fal" | "runware"
  model: string
  input: Record<string, unknown>
  tags?: string[]
  slug?: string

  // Execution preferences
  wait?: boolean // Keep connection open until complete
  timeout?: number // Max wait time in ms
  expectedCount?: number // Override batch size detection
}

/**
 * Response from generation creation
 */
export interface CreateGenerationResponse {
  id: string
  slug: string | null
  status: GenerationStatus
}

/**
 * Webhook payload envelope (provider-agnostic)
 */
export interface WebhookPayload {
  provider: "fal" | "runware"
  generationId: string
  rawPayload: unknown
}

/**
 * Internal message types for DO RPC
 */
export type DOMessage =
  | { type: "create"; request: CreateGenerationRequest }
  | { type: "webhook"; payload: WebhookPayload }
  | { type: "getState" }
  | { type: "cancel" }

/**
 * Configuration for the Generation Manager
 */
export interface GenerationManagerConfig {
  // Default timeout for sync wait (ms)
  defaultWaitTimeout: number

  // Max connections per DO
  maxWebSocketConnections: number

  // Auto-complete even if not all results received after this delay (ms)
  batchTimeout: number
}

export const DEFAULT_CONFIG: GenerationManagerConfig = {
  defaultWaitTimeout: 60_000, // 1 minute
  maxWebSocketConnections: 100,
  batchTimeout: 300_000, // 5 minutes
}

/**
 * Attachment data stored with each WebSocket for hibernation
 */
export interface WSAttachment {
  connectedAt: number
  clientId: string
}
