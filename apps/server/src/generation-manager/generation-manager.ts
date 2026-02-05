/**
 * Generation Manager Durable Object
 *
 * Manages the full lifecycle of a generation request:
 * - Aggregates multiple webhook callbacks (solves batch problem)
 * - Accepts WebSocket connections for real-time updates
 * - Supports multiple execution strategies
 * - Hibernates when idle to minimize costs
 *
 * PROTOTYPE - Not fully functional, demonstrates architecture patterns
 */

import { DurableObject } from "cloudflare:workers"
import type {
  GenerationState,
  GenerationStatus,
  CreateGenerationRequest,
  WebhookPayload,
  OutputResult,
  WSClientEvent,
  WSClientMessage,
  WSAttachment,
  DEFAULT_CONFIG,
} from "./types"

// Storage keys
const STATE_KEY = "generation_state"

/**
 * Extract expected result count from input parameters
 */
function inferExpectedCount(provider: string, input: Record<string, unknown>): number {
  if (provider === "runware") {
    // Runware uses numberResults
    const count = input.numberResults ?? input.numberOfImages ?? 1
    return typeof count === "number" ? count : 1
  }

  if (provider === "fal") {
    // fal.ai uses num_images for image models
    const count = input.num_images ?? input.num_outputs ?? 1
    return typeof count === "number" ? count : 1
  }

  return 1
}

/**
 * Generate a short slug from ID
 */
function makeSlug(id: string, slugArg?: string): string | null {
  const PREFIX_LENGTH = 8
  return slugArg ? `${id.slice(0, PREFIX_LENGTH)}-${slugArg}` : null
}

export class GenerationManager extends DurableObject<Env> {
  private state: GenerationState | null = null

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)

    // Configure auto-response for ping/pong to avoid waking from hibernation
    this.ctx.setWebSocketAutoResponse(
      new WebSocketRequestResponsePair('{"type":"ping"}', '{"type":"pong"}')
    )
  }

  /**
   * Restore state from storage (called after hibernation wake)
   */
  private async loadState(): Promise<GenerationState | null> {
    if (this.state) return this.state

    this.state = await this.ctx.storage.get<GenerationState>(STATE_KEY) ?? null
    return this.state
  }

  /**
   * Persist state to storage (for hibernation)
   */
  private async saveState(): Promise<void> {
    if (this.state) {
      await this.ctx.storage.put(STATE_KEY, this.state)
    }
  }

  /**
   * Main HTTP fetch handler
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    const path = url.pathname

    // WebSocket upgrade
    if (request.headers.get("Upgrade") === "websocket") {
      return this.handleWebSocketUpgrade(request)
    }

    // REST endpoints
    if (request.method === "POST" && path === "/create") {
      return this.handleCreate(request)
    }

    if (request.method === "POST" && path === "/webhook") {
      return this.handleWebhook(request)
    }

    if (request.method === "GET" && path === "/state") {
      return this.handleGetState()
    }

    return new Response("Not Found", { status: 404 })
  }

  /**
   * Handle generation creation
   */
  private async handleCreate(request: Request): Promise<Response> {
    const body = await request.json() as CreateGenerationRequest

    // Generate ID using the DO's unique ID
    const id = this.ctx.id.toString()
    const slug = makeSlug(id, body.slug)

    // Determine expected count from input
    const expectedCount = body.expectedCount ?? inferExpectedCount(body.provider, body.input)

    // Initialize state
    this.state = {
      id,
      provider: body.provider,
      model: body.model,
      slug,
      input: body.input,
      tags: body.tags ?? [],
      status: "pending",
      expectedCount,
      receivedCount: 0,
      outputs: [],
      strategy: body.wait ? "sync" : "webhook",
      createdAt: Date.now(),
    }

    await this.saveState()

    // TODO: Actually submit to provider here
    // For now, this is just state initialization
    // In real implementation:
    // await this.submitToProvider(body.provider, body.model, body.input)

    // Broadcast status to any connected clients
    this.broadcast({ type: "status", status: "pending", generationId: id })

    return Response.json({
      id,
      slug,
      status: this.state.status,
    })
  }

  /**
   * Handle incoming webhook from provider
   */
  private async handleWebhook(request: Request): Promise<Response> {
    await this.loadState()

    if (!this.state) {
      return new Response("Generation not found", { status: 404 })
    }

    // Already complete - idempotent success
    if (this.state.status === "ready" || this.state.status === "failed") {
      return Response.json({ ok: true, alreadyProcessed: true })
    }

    const payload = await request.json() as WebhookPayload

    // Resolve the webhook payload based on provider
    const result = await this.resolveWebhookPayload(payload)

    if (!result.ok) {
      // Handle error case
      this.state.status = "failed"
      this.state.errorCode = result.code
      this.state.errorMessage = result.message
      this.state.completedAt = Date.now()

      await this.saveState()

      this.broadcast({
        type: "error",
        code: result.code,
        message: result.message,
        generationId: this.state.id,
      })

      return Response.json({ ok: true, error: true })
    }

    // Accumulate results - THIS IS THE KEY FIX FOR BATCH WEBHOOKS
    for (const output of result.outputs) {
      this.state.outputs.push(output)
      this.state.receivedCount++

      // Broadcast progress
      this.broadcast({
        type: "progress",
        received: this.state.receivedCount,
        expected: this.state.expectedCount,
        generationId: this.state.id,
      })

      // If output is successful, broadcast result event
      if (output.ok) {
        this.broadcast({
          type: "result",
          index: this.state.receivedCount - 1,
          contentType: output.contentType,
          generationId: this.state.id,
        })
      }
    }

    // Update provider metadata if present
    if (result.metadata) {
      this.state.providerMetadata = {
        ...this.state.providerMetadata,
        ...result.metadata,
      }
    }

    if (result.requestId) {
      this.state.providerRequestId = result.requestId
    }

    // Check if all expected results have been received
    if (this.state.receivedCount >= this.state.expectedCount) {
      await this.complete()
    } else {
      // Update status to processing (partial results received)
      this.state.status = "processing"
    }

    await this.saveState()

    return Response.json({
      ok: true,
      received: this.state.receivedCount,
      expected: this.state.expectedCount,
    })
  }

  /**
   * Resolve webhook payload - placeholder for actual implementation
   */
  private async resolveWebhookPayload(payload: WebhookPayload): Promise<ResolverResult> {
    // In real implementation, this would call the appropriate resolver
    // based on payload.provider (fal or runware)

    // For prototype, return placeholder
    if (payload.provider === "runware") {
      // Would call resolveRunwareWebhook(payload.rawPayload)
      return {
        ok: true,
        outputs: [], // Would be actual resolved outputs
        requestId: undefined,
        metadata: undefined,
      }
    }

    if (payload.provider === "fal") {
      // Would call resolveFalWebhook(payload.rawPayload)
      return {
        ok: true,
        outputs: [],
        requestId: undefined,
        metadata: undefined,
      }
    }

    return {
      ok: false,
      code: "UNKNOWN_PROVIDER",
      message: `Unknown provider: ${payload.provider}`,
    }
  }

  /**
   * Mark generation as complete
   */
  private async complete(): Promise<void> {
    if (!this.state) return

    this.state.status = "ready"
    this.state.completedAt = Date.now()

    // TODO: Store outputs to R2 here
    // For each output in this.state.outputs, store to R2 bucket

    await this.saveState()

    // Broadcast completion
    this.broadcast({
      type: "complete",
      outputCount: this.state.outputs.filter(o => o.ok).length,
      generationId: this.state.id,
    })

    // Close all WebSocket connections gracefully
    for (const ws of this.ctx.getWebSockets()) {
      ws.close(1000, "Generation complete")
    }
  }

  /**
   * Handle GET state request
   */
  private async handleGetState(): Promise<Response> {
    await this.loadState()

    if (!this.state) {
      return new Response("Generation not found", { status: 404 })
    }

    // Return state without binary data
    const { outputs, ...stateWithoutOutputs } = this.state
    return Response.json({
      ...stateWithoutOutputs,
      outputCount: outputs.filter(o => o.ok).length,
      errorCount: outputs.filter(o => !o.ok).length,
    })
  }

  // ============================================================
  // WebSocket Handling with Hibernation Support
  // ============================================================

  /**
   * Handle WebSocket upgrade request
   */
  private handleWebSocketUpgrade(request: Request): Response {
    const pair = new WebSocketPair()
    const [client, server] = Object.values(pair)

    // Create attachment for this connection
    const attachment: WSAttachment = {
      connectedAt: Date.now(),
      clientId: crypto.randomUUID(),
    }

    // Accept the WebSocket with hibernation support
    this.ctx.acceptWebSocket(server, [JSON.stringify(attachment)])

    return new Response(null, {
      status: 101,
      webSocket: client,
    })
  }

  /**
   * Handle WebSocket messages (called after waking from hibernation)
   */
  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    await this.loadState()

    if (typeof message !== "string") {
      return // Ignore binary messages
    }

    try {
      const data = JSON.parse(message) as WSClientMessage

      switch (data.type) {
        case "subscribe":
          // Client wants current state
          await this.sendCurrentState(ws)
          break

        case "ping":
          // Should be auto-handled, but respond anyway
          ws.send(JSON.stringify({ type: "pong" }))
          break
      }
    } catch {
      // Invalid message, ignore
    }
  }

  /**
   * Handle WebSocket close
   */
  async webSocketClose(ws: WebSocket, code: number, reason: string): Promise<void> {
    // WebSocket closed - nothing special to do
    // Hibernation API handles cleanup
  }

  /**
   * Handle WebSocket error
   */
  async webSocketError(ws: WebSocket, error: unknown): Promise<void> {
    console.error("WebSocket error:", error)
    ws.close(1011, "Internal error")
  }

  /**
   * Send current state to a specific WebSocket
   */
  private async sendCurrentState(ws: WebSocket): Promise<void> {
    await this.loadState()

    if (!this.state) {
      ws.send(JSON.stringify({
        type: "error",
        code: "NOT_FOUND",
        message: "Generation not found",
        generationId: "",
      } satisfies WSClientEvent))
      return
    }

    // Send connected event
    ws.send(JSON.stringify({
      type: "connected",
      generationId: this.state.id,
    } satisfies WSClientEvent))

    // Send current status
    ws.send(JSON.stringify({
      type: "status",
      status: this.state.status,
      generationId: this.state.id,
    } satisfies WSClientEvent))

    // If in progress, send progress
    if (this.state.status === "processing") {
      ws.send(JSON.stringify({
        type: "progress",
        received: this.state.receivedCount,
        expected: this.state.expectedCount,
        generationId: this.state.id,
      } satisfies WSClientEvent))
    }

    // If complete, send completion
    if (this.state.status === "ready") {
      ws.send(JSON.stringify({
        type: "complete",
        outputCount: this.state.outputs.filter(o => o.ok).length,
        generationId: this.state.id,
      } satisfies WSClientEvent))
    }

    // If failed, send error
    if (this.state.status === "failed" && this.state.errorCode) {
      ws.send(JSON.stringify({
        type: "error",
        code: this.state.errorCode,
        message: this.state.errorMessage ?? "Unknown error",
        generationId: this.state.id,
      } satisfies WSClientEvent))
    }
  }

  /**
   * Broadcast event to all connected WebSockets
   */
  private broadcast(event: WSClientEvent): void {
    const message = JSON.stringify(event)

    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(message)
      } catch {
        // Client disconnected, will be cleaned up
      }
    }
  }
}

// Type for webhook resolution results
type ResolverResult =
  | {
      ok: true
      outputs: OutputResult[]
      requestId?: string
      metadata?: Record<string, unknown>
    }
  | {
      ok: false
      code: string
      message: string
    }
