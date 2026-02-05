/**
 * Runware-Specific Generation Manager Durable Object
 *
 * A focused prototype showing exactly how Durable Objects solve the
 * Runware batch webhook problem.
 *
 * KEY INSIGHT: Runware sends separate webhooks for each image in a batch.
 * Current webhook handler marks generation "ready" after first webhook,
 * losing all subsequent images. This DO accumulates all webhooks before
 * marking complete.
 *
 * PROTOTYPE - demonstrates the pattern, not fully functional
 */

import { DurableObject } from "cloudflare:workers"

// Types
interface RunwareGenerationState {
  id: string
  model: string
  input: Record<string, unknown>
  tags: string[]
  status: "pending" | "submitted" | "processing" | "ready" | "failed"

  // Batch tracking - THE KEY TO SOLVING THE PROBLEM
  expectedCount: number
  receivedResults: RunwareResult[]

  // Metadata
  createdAt: number
  completedAt?: number
  errorCode?: string
  errorMessage?: string
}

interface RunwareResult {
  taskUUID: string
  imageURL?: string
  imageBase64Data?: string
  cost?: number
  receivedAt: number
  // ... other fields from webhook
}

interface WSEvent {
  type: "status" | "progress" | "image" | "complete" | "error"
  payload: unknown
}

const STATE_KEY = "state"
const RESULTS_PREFIX = "result:"

export class RunwareGenerationDO extends DurableObject<Env> {
  private state: RunwareGenerationState | null = null

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)

    // Auto-respond to pings without waking from hibernation
    this.ctx.setWebSocketAutoResponse(
      new WebSocketRequestResponsePair('{"type":"ping"}', '{"type":"pong"}')
    )
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)

    // WebSocket upgrade for real-time streaming
    if (request.headers.get("Upgrade") === "websocket") {
      return this.handleWebSocket(request)
    }

    // Initialize generation
    if (request.method === "POST" && url.pathname === "/init") {
      return this.handleInit(request)
    }

    // Receive webhook callback
    if (request.method === "POST" && url.pathname === "/webhook") {
      return this.handleWebhook(request)
    }

    // Long poll - wait for completion
    if (request.method === "GET" && url.pathname === "/wait") {
      return this.handleWait(request)
    }

    // Get current state
    if (request.method === "GET" && url.pathname === "/state") {
      return this.handleGetState()
    }

    return new Response("Not Found", { status: 404 })
  }

  /**
   * Initialize generation state
   */
  private async handleInit(request: Request): Promise<Response> {
    const body = await request.json() as {
      model: string
      input: Record<string, unknown>
      tags?: string[]
    }

    // Determine expected count from input
    // Runware uses numberResults for batch size
    const expectedCount = typeof body.input.numberResults === "number"
      ? body.input.numberResults
      : 1

    this.state = {
      id: this.ctx.id.toString(),
      model: body.model,
      input: body.input,
      tags: body.tags ?? [],
      status: "pending",
      expectedCount,
      receivedResults: [],
      createdAt: Date.now(),
    }

    await this.ctx.storage.put(STATE_KEY, this.state)

    console.log("runware_do_init", {
      id: this.state.id,
      model: this.state.model,
      expectedCount: this.state.expectedCount,
    })

    return Response.json({
      id: this.state.id,
      expectedCount: this.state.expectedCount,
    })
  }

  /**
   * Handle incoming webhook from Runware
   *
   * This is where the magic happens - we ACCUMULATE results instead of
   * completing immediately.
   */
  private async handleWebhook(request: Request): Promise<Response> {
    await this.loadState()

    if (!this.state) {
      return new Response("Generation not found", { status: 404 })
    }

    // Already done - idempotent
    if (this.state.status === "ready" || this.state.status === "failed") {
      console.log("runware_do_webhook_already_done", { id: this.state.id })
      return Response.json({ ok: true, alreadyProcessed: true })
    }

    const payload = await request.json() as RunwareWebhookPayload

    // Handle error response
    if ("error" in payload) {
      this.state.status = "failed"
      this.state.errorCode = "RUNWARE_ERROR"
      this.state.errorMessage = (payload.error as { message: string }).message
      this.state.completedAt = Date.now()

      await this.ctx.storage.put(STATE_KEY, this.state)
      this.broadcast({ type: "error", payload: { code: this.state.errorCode, message: this.state.errorMessage } })

      return Response.json({ ok: true, error: true })
    }

    // Process each result in the data array
    // Runware sends results as they complete, potentially in batches
    const { data } = payload

    for (const item of data) {
      // Check for duplicates (idempotency)
      const isDuplicate = this.state.receivedResults.some(r => r.taskUUID === item.taskUUID)
      if (isDuplicate) {
        console.log("runware_do_webhook_duplicate", { taskUUID: item.taskUUID })
        continue
      }

      const result: RunwareResult = {
        taskUUID: item.taskUUID,
        imageURL: item.imageURL,
        imageBase64Data: item.imageBase64Data,
        cost: item.cost,
        receivedAt: Date.now(),
      }

      // Store result individually for reliability
      await this.ctx.storage.put(`${RESULTS_PREFIX}${item.taskUUID}`, result)

      // Add to in-memory state
      this.state.receivedResults.push(result)

      console.log("runware_do_webhook_result", {
        id: this.state.id,
        taskUUID: item.taskUUID,
        received: this.state.receivedResults.length,
        expected: this.state.expectedCount,
      })

      // Broadcast progress to connected WebSocket clients
      this.broadcast({
        type: "progress",
        payload: {
          received: this.state.receivedResults.length,
          expected: this.state.expectedCount,
        },
      })

      // Broadcast the image itself (URL or signal to fetch)
      if (item.imageURL) {
        this.broadcast({
          type: "image",
          payload: {
            index: this.state.receivedResults.length - 1,
            url: item.imageURL,
          },
        })
      }
    }

    // Update status
    this.state.status = "processing"

    // Check if all expected results received
    if (this.state.receivedResults.length >= this.state.expectedCount) {
      await this.complete()
    } else {
      await this.ctx.storage.put(STATE_KEY, this.state)
    }

    return Response.json({
      ok: true,
      received: this.state.receivedResults.length,
      expected: this.state.expectedCount,
      complete: this.state.status === "ready",
    })
  }

  /**
   * Mark generation as complete
   */
  private async complete(): Promise<void> {
    if (!this.state) return

    this.state.status = "ready"
    this.state.completedAt = Date.now()

    await this.ctx.storage.put(STATE_KEY, this.state)

    console.log("runware_do_complete", {
      id: this.state.id,
      resultCount: this.state.receivedResults.length,
    })

    // Broadcast completion to all connected clients
    this.broadcast({
      type: "complete",
      payload: {
        resultCount: this.state.receivedResults.length,
      },
    })

    // TODO: Store images to R2 here
    // for (const result of this.state.receivedResults) {
    //   await storeToR2(result)
    // }
  }

  /**
   * Long poll endpoint - wait for completion
   *
   * This allows clients to submit a request and wait for it to complete
   * in a single HTTP request.
   */
  private async handleWait(request: Request): Promise<Response> {
    await this.loadState()

    if (!this.state) {
      return new Response("Generation not found", { status: 404 })
    }

    // Already complete - return immediately
    if (this.state.status === "ready" || this.state.status === "failed") {
      return Response.json(this.getPublicState())
    }

    // Parse timeout from query
    const url = new URL(request.url)
    const timeout = parseInt(url.searchParams.get("timeout") ?? "30000", 10)
    const maxTimeout = Math.min(timeout, 55000) // Stay under 60s CF limit

    // Wait for completion or timeout
    const start = Date.now()

    while (Date.now() - start < maxTimeout) {
      // Re-check state (it may have been updated by webhook)
      await this.loadState()

      if (!this.state) {
        return new Response("Generation not found", { status: 404 })
      }

      if (this.state.status === "ready" || this.state.status === "failed") {
        return Response.json(this.getPublicState())
      }

      // Sleep briefly and check again
      await new Promise(r => setTimeout(r, 500))
    }

    // Timeout - return current state
    return Response.json({
      ...this.getPublicState(),
      timeout: true,
    })
  }

  /**
   * Get current state
   */
  private async handleGetState(): Promise<Response> {
    await this.loadState()

    if (!this.state) {
      return new Response("Generation not found", { status: 404 })
    }

    return Response.json(this.getPublicState())
  }

  /**
   * Get state for API response (excludes internal fields)
   */
  private getPublicState() {
    if (!this.state) return null

    return {
      id: this.state.id,
      status: this.state.status,
      model: this.state.model,
      expectedCount: this.state.expectedCount,
      receivedCount: this.state.receivedResults.length,
      results: this.state.receivedResults.map(r => ({
        taskUUID: r.taskUUID,
        imageURL: r.imageURL,
        cost: r.cost,
      })),
      createdAt: this.state.createdAt,
      completedAt: this.state.completedAt,
      errorCode: this.state.errorCode,
      errorMessage: this.state.errorMessage,
    }
  }

  // ============================================================
  // WebSocket with Hibernation
  // ============================================================

  private handleWebSocket(request: Request): Response {
    const pair = new WebSocketPair()
    const [client, server] = Object.values(pair)

    // Accept with hibernation support
    this.ctx.acceptWebSocket(server)

    return new Response(null, { status: 101, webSocket: client })
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (typeof message !== "string") return

    try {
      const data = JSON.parse(message)

      if (data.type === "subscribe") {
        // Send current state
        await this.loadState()
        if (this.state) {
          ws.send(JSON.stringify({
            type: "status",
            payload: this.getPublicState(),
          }))
        }
      }
    } catch {
      // Invalid message
    }
  }

  async webSocketClose(): Promise<void> {
    // Connection closed - hibernation handles cleanup
  }

  async webSocketError(ws: WebSocket, error: unknown): Promise<void> {
    console.error("WebSocket error:", error)
  }

  /**
   * Broadcast to all connected WebSockets
   */
  private broadcast(event: WSEvent): void {
    const message = JSON.stringify(event)
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(message)
      } catch {
        // Client disconnected
      }
    }
  }

  /**
   * Load state from storage
   */
  private async loadState(): Promise<void> {
    if (!this.state) {
      this.state = await this.ctx.storage.get<RunwareGenerationState>(STATE_KEY) ?? null

      // Reconstruct receivedResults from individual storage if needed
      if (this.state && this.state.receivedResults.length === 0) {
        const stored = await this.ctx.storage.list<RunwareResult>({
          prefix: RESULTS_PREFIX,
        })
        this.state.receivedResults = [...stored.values()]
      }
    }
  }
}

// Runware webhook payload type
interface RunwareWebhookPayload {
  data: Array<{
    taskUUID: string
    imageURL?: string
    imageBase64Data?: string
    cost?: number
    [key: string]: unknown
  }>
  error?: { message: string }
}
