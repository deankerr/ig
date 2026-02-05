/**
 * Worker-side client for interacting with Generation Manager DOs
 *
 * Provides a clean interface for:
 * - Creating new generations (via DO)
 * - Routing webhooks to the correct DO
 * - Getting generation state
 * - Upgrading HTTP requests to WebSocket connections
 */

import type {
  CreateGenerationRequest,
  CreateGenerationResponse,
  GenerationState,
  WebhookPayload,
} from "./types"

/**
 * Client for Generation Manager Durable Objects
 */
export class GenerationManagerClient {
  constructor(private namespace: DurableObjectNamespace) {}

  /**
   * Create a new generation and return its ID
   *
   * The DO instance is created with a new unique ID, which becomes
   * the generation ID.
   */
  async create(request: CreateGenerationRequest): Promise<CreateGenerationResponse> {
    // Generate a new unique DO ID
    const doId = this.namespace.newUniqueId()
    const stub = this.namespace.get(doId)

    // Call the DO's create endpoint
    const response = await stub.fetch("https://do/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Failed to create generation: ${text}`)
    }

    return response.json() as Promise<CreateGenerationResponse>
  }

  /**
   * Route a webhook to the appropriate DO
   *
   * The generation_id query parameter identifies which DO should
   * receive the webhook.
   */
  async handleWebhook(
    generationId: string,
    provider: "fal" | "runware",
    rawPayload: unknown
  ): Promise<{ ok: boolean; received?: number; expected?: number }> {
    // Get the DO by name (generation ID)
    const doId = this.namespace.idFromName(generationId)
    const stub = this.namespace.get(doId)

    const payload: WebhookPayload = {
      provider,
      generationId,
      rawPayload,
    }

    const response = await stub.fetch("https://do/webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Webhook handling failed: ${text}`)
    }

    return response.json()
  }

  /**
   * Get the current state of a generation
   */
  async getState(generationId: string): Promise<GenerationState | null> {
    const doId = this.namespace.idFromName(generationId)
    const stub = this.namespace.get(doId)

    const response = await stub.fetch("https://do/state", {
      method: "GET",
    })

    if (response.status === 404) {
      return null
    }

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Failed to get state: ${text}`)
    }

    return response.json() as Promise<GenerationState>
  }

  /**
   * Upgrade an HTTP request to a WebSocket connection to a generation's DO
   *
   * Use this when a client connects to /generations/:id/stream
   */
  async upgradeToWebSocket(
    generationId: string,
    request: Request
  ): Promise<Response> {
    const doId = this.namespace.idFromName(generationId)
    const stub = this.namespace.get(doId)

    // Forward the request to the DO
    // The DO will handle the WebSocket upgrade
    return stub.fetch(request)
  }
}

/**
 * Example usage in Hono routes:
 *
 * ```typescript
 * import { Hono } from "hono"
 * import { GenerationManagerClient } from "./generation-manager/client"
 *
 * const app = new Hono<{ Bindings: Env }>()
 *
 * // Create generation via DO
 * app.post("/generations", async (c) => {
 *   const client = new GenerationManagerClient(c.env.GENERATION_MANAGER)
 *   const body = await c.req.json()
 *
 *   const result = await client.create({
 *     provider: body.provider,
 *     model: body.model,
 *     input: body.input,
 *     tags: body.tags,
 *     wait: body.wait,
 *   })
 *
 *   return c.json(result)
 * })
 *
 * // WebSocket stream endpoint
 * app.get("/generations/:id/stream", async (c) => {
 *   const client = new GenerationManagerClient(c.env.GENERATION_MANAGER)
 *   const id = c.req.param("id")
 *
 *   // This upgrades the connection to WebSocket
 *   return client.upgradeToWebSocket(id, c.req.raw)
 * })
 *
 * // Runware webhook - now routes to DO
 * app.post("/webhooks/runware", async (c) => {
 *   const client = new GenerationManagerClient(c.env.GENERATION_MANAGER)
 *   const generationId = c.req.query("generation_id")
 *
 *   if (!generationId) {
 *     return c.json({ error: "Missing generation_id" }, 400)
 *   }
 *
 *   const payload = await c.req.json()
 *   const result = await client.handleWebhook(generationId, "runware", payload)
 *
 *   return c.json(result)
 * })
 * ```
 */
