/**
 * Generation Manager Durable Object exports
 *
 * The Generation Manager DO is responsible for managing the full lifecycle
 * of generation requests, including:
 *
 * - Creating generation records
 * - Submitting to providers (fal, runware)
 * - Aggregating webhook callbacks (solving batch problem)
 * - Broadcasting progress to WebSocket clients
 * - Storing results to R2
 *
 * PROTOTYPE - Architecture demonstration, not production-ready
 */

export { GenerationManager } from "./generation-manager"
export { GenerationManagerClient } from "./client"
export type {
  GenerationState,
  GenerationStatus,
  CreateGenerationRequest,
  CreateGenerationResponse,
  WSClientEvent,
  WSClientMessage,
  OutputResult,
  ResolvedOutput,
  FailedOutput,
} from "./types"
