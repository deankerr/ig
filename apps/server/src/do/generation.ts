import * as schema from '@ig/db/schema'
import { DurableObject } from 'cloudflare:workers'
import { drizzle } from 'drizzle-orm/d1'
import { v7 as uuidv7 } from 'uuid'
import { z } from 'zod'

import {
  type ImageInferenceInput,
  type RunwareError,
  getContentType,
  imageInferenceWebhook,
} from '../providers/runware/schemas'
import { type SerializedError, serializeError } from '../utils/error'

const RUNWARE_API_URL = 'https://api.runware.ai/v1'
const TIMEOUT_MS = 5 * 60 * 1000

type CreateRequest = { id: string } & ImageInferenceInput

// -- Top-level generation errors (state.error) --

type HttpError = { code: 'http_error' | 'fetch_failed'; url: string; status: number; body: string }
type ApiRejection = { code: 'api_rejected'; errors: RunwareError[] }
type TimeoutError = { code: 'timeout'; received: number; expected: number }
type GenerationError = HttpError | ApiRejection | TimeoutError

// -- Per-output errors (output.error) --

type FlatError = { formErrors: string[]; fieldErrors: Record<string, string[] | undefined> }
type ValidationError = { code: 'validation'; issues: FlatError }
type WebhookError = { code: 'webhook_error'; errors: RunwareError[] }
type StorageError = { code: 'storage_failed'; r2Key: string; cause: SerializedError }
type OutputErrorDetail = ValidationError | WebhookError | HttpError | StorageError

// -- Output types --

type OutputSuccess = {
  type: 'success'
  id: string
  r2Key: string
  contentType: string
  seed: number
  cost?: number
  metadata: Record<string, unknown>
  createdAt: number
}

type OutputError = {
  type: 'error'
  error: OutputErrorDetail
  raw: unknown
  createdAt: number
}

type Output = OutputSuccess | OutputError

type GenerationState = {
  id: string
  model: string
  input: Record<string, unknown>
  outputFormat: ImageInferenceInput['outputFormat']
  expectedCount: number
  outputs: Output[]
  error?: GenerationError
  createdAt: number
  completedAt?: number
}

export class GenerationDO extends DurableObject<Env> {
  private state: GenerationState | undefined

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    void ctx.blockConcurrencyWhile(async () => {
      this.state = await ctx.storage.get('state')
    })
  }

  // 1. Client calls create → dispatch to Runware, throw on rejection
  async create(request: CreateRequest) {
    const now = Date.now()
    const webhookURL = `${this.env.PUBLIC_URL}/webhooks/runware?generation_id=${request.id}`

    // Build inference task from validated input + defaults
    const inferenceTask = {
      taskType: 'imageInference' as const,
      taskUUID: request.id,
      ...request,
      width: request.width ?? 1024,
      height: request.height ?? 1024,
      outputType: 'URL' as const,
      includeCost: true,
      webhookURL,
    }

    // Persist state before dispatching
    this.state = {
      id: request.id,
      model: request.model,
      input: inferenceTask,
      outputFormat: request.outputFormat,
      expectedCount: request.numberResults,
      outputs: [],
      createdAt: now,
    }
    await this.ctx.storage.put('state', this.state)
    await this.ctx.storage.setAlarm(now + TIMEOUT_MS)

    // Send to Runware API
    const response = await fetch(RUNWARE_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([
        { taskType: 'authentication', apiKey: this.env.RUNWARE_KEY },
        inferenceTask,
      ]),
    })

    // HTTP-level failure
    if (!response.ok) {
      this.state.completedAt = Date.now()
      this.state.error = {
        code: 'http_error',
        url: RUNWARE_API_URL,
        status: response.status,
        body: await response.text(),
      }
      await this.ctx.storage.put('state', this.state)
      await this.persistToD1(this.state)
      throw new Error(`Runware API error: ${response.status}`)
    }

    // Application-level rejection (e.g. invalid dimensions for model)
    const body = (await response.json()) as { data?: unknown[]; errors?: RunwareError[] }
    if (body.errors?.length) {
      this.state.completedAt = Date.now()
      this.state.error = { code: 'api_rejected', errors: body.errors }
      await this.ctx.storage.put('state', this.state)
      await this.persistToD1(this.state)
      throw new Error(`Runware error: ${JSON.stringify(body.errors)}`)
    }
  }

  // 2. Runware calls webhook per completed image → validate, fetch, store
  async handleWebhook(payload: unknown) {
    if (!this.state) throw new Error('No generation state')

    const now = Date.now()
    const parsed = imageInferenceWebhook.safeParse(payload)

    // Payload didn't match any known shape
    if (!parsed.success) {
      const error: ValidationError = { code: 'validation', issues: z.flattenError(parsed.error) }
      this.state.outputs.push({ type: 'error', error, raw: payload, createdAt: now })
      await this.ctx.storage.put('state', this.state)
      return
    }

    // Runware reported an error for this task
    if ('errors' in parsed.data) {
      const error: WebhookError = { code: 'webhook_error', errors: parsed.data.errors }
      this.state.outputs.push({ type: 'error', error, raw: payload, createdAt: now })
      await this.ctx.storage.put('state', this.state)
      return
    }

    // Process each result in the webhook data
    const { data } = parsed.data
    const contentType = getContentType(this.state.outputFormat)

    for (const result of data) {
      // Fetch image from Runware CDN
      const response = await fetch(result.imageURL)
      if (!response.ok) {
        const error: HttpError = {
          code: 'fetch_failed',
          url: result.imageURL,
          status: response.status,
          body: await response.text(),
        }
        this.state.outputs.push({ type: 'error', error, raw: result, createdAt: now })
        continue
      }

      // Stream to R2
      const id = uuidv7()
      const r2Key = `generations/${id}`

      try {
        await this.env.GENERATIONS_BUCKET.put(r2Key, response.body, {
          httpMetadata: { contentType },
        })
      } catch (err) {
        const error: StorageError = { code: 'storage_failed', r2Key, cause: serializeError(err) }
        this.state.outputs.push({ type: 'error', error, raw: result, createdAt: now })
        continue
      }

      // Record success
      this.state.outputs.push({
        type: 'success',
        id,
        r2Key,
        contentType,
        seed: result.seed,
        cost: result.cost,
        metadata: result as Record<string, unknown>,
        createdAt: now,
      })
    }

    // Check completion
    if (this.state.outputs.length >= this.state.expectedCount) {
      this.state.completedAt = Date.now()
      await this.ctx.storage.put('state', this.state)
      await this.persistToD1(this.state)
      return
    }

    await this.ctx.storage.put('state', this.state)
  }

  // 3. Client polls for current state
  getState() {
    return this.state ?? null
  }

  // 4. Timeout — mark failed if still waiting for webhooks
  override async alarm() {
    if (!this.state || this.state.completedAt) return

    this.state.completedAt = Date.now()
    this.state.error = {
      code: 'timeout',
      received: this.state.outputs.length,
      expected: this.state.expectedCount,
    }
    await this.ctx.storage.put('state', this.state)
    await this.persistToD1(this.state)
  }

  // 5. Project successful outputs into D1 as artifacts
  private async persistToD1(state: GenerationState) {
    const db = drizzle(this.env.DB, { schema })
    const successes = state.outputs.filter((o): o is OutputSuccess => o.type === 'success')

    try {
      await db.insert(schema.runwareGenerations).values({
        id: state.id,
        model: state.model,
        input: state.input,
        artifactCount: successes.length,
        createdAt: new Date(state.createdAt),
        completedAt: new Date(state.completedAt!),
      })

      for (const output of successes) {
        await db.insert(schema.runwareArtifacts).values({
          id: output.id,
          generationId: state.id,
          model: state.model,
          r2Key: output.r2Key,
          contentType: output.contentType,
          seed: output.seed,
          cost: output.cost,
          metadata: output.metadata,
          createdAt: new Date(output.createdAt),
        })
      }
    } catch (err) {
      const cause = err instanceof Error ? err.cause : undefined
      console.error('D1 projection failed', { generationId: state.id, error: err, cause })
    }
  }
}
