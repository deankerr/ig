import { DurableObject } from 'cloudflare:workers'
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

type OutputBase = {
  raw: unknown
  receivedAt: number
}

type OutputSuccess = OutputBase & {
  type: 'success'
  id: string
  imageUUID: string
  r2Key: string
  contentType: string
  seed: number
  cost?: number
}

type OutputError = OutputBase & {
  type: 'error'
  error: OutputErrorDetail
}

type Output = OutputSuccess | OutputError

type GenerationState = {
  id: string
  model: string
  input: Record<string, unknown>
  outputFormat: ImageInferenceInput['outputFormat']
  count: number
  outputs: Output[]
  status: 'active' | 'done' | 'failed'
  error?: GenerationError
  createdAt: number
}

export class GenerationDO extends DurableObject<Env> {
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
    const state: GenerationState = {
      id: request.id,
      model: request.model,
      input: inferenceTask,
      outputFormat: request.outputFormat,
      count: request.numberResults,
      outputs: [],
      status: 'active',
      createdAt: now,
    }
    await this.ctx.storage.put('state', state)
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
      state.status = 'failed'
      state.error = {
        code: 'http_error',
        url: RUNWARE_API_URL,
        status: response.status,
        body: await response.text(),
      }
      await this.ctx.storage.put('state', state)
      throw new Error(`Runware API error: ${response.status}`)
    }

    // Application-level rejection (e.g. invalid dimensions for model)
    const body = (await response.json()) as { data?: unknown[]; errors?: RunwareError[] }
    if (body.errors?.length) {
      state.status = 'failed'
      state.error = { code: 'api_rejected', errors: body.errors }
      await this.ctx.storage.put('state', state)
      throw new Error(`Runware error: ${JSON.stringify(body.errors)}`)
    }
  }

  // 2. Runware calls webhook per completed image → validate, fetch, store
  async handleWebhook(payload: unknown) {
    const state = await this.ctx.storage.get<GenerationState>('state')
    if (!state) throw new Error('No generation state')

    const now = Date.now()
    const parsed = imageInferenceWebhook.safeParse(payload)

    // Payload didn't match any known shape
    if (!parsed.success) {
      const error: ValidationError = { code: 'validation', issues: z.flattenError(parsed.error) }
      state.outputs.push({ type: 'error', error, raw: payload, receivedAt: now })
      await this.ctx.storage.put('state', state)
      return
    }

    // Runware reported an error for this task
    if ('errors' in parsed.data) {
      const error: WebhookError = { code: 'webhook_error', errors: parsed.data.errors }
      state.outputs.push({ type: 'error', error, raw: payload, receivedAt: now })
      await this.ctx.storage.put('state', state)
      return
    }

    // Process each result in the webhook data
    const { data } = parsed.data
    const contentType = getContentType(state.outputFormat)

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
        state.outputs.push({ type: 'error', error, raw: result, receivedAt: now })
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
        state.outputs.push({ type: 'error', error, raw: result, receivedAt: now })
        continue
      }

      // Record success
      const output: OutputSuccess = {
        type: 'success',
        id,
        imageUUID: result.imageUUID,
        r2Key,
        contentType,
        seed: result.seed,
        cost: result.cost,
        raw: result,
        receivedAt: now,
      }
      state.outputs.push(output)

      await dummyDbInsert({ ...output, generationId: state.id, model: state.model })
    }

    // Check completion
    if (state.outputs.length >= state.count) {
      state.status = 'done'
    }

    await this.ctx.storage.put('state', state)
  }

  // 3. Client polls for current state
  async getState() {
    return this.ctx.storage.get<GenerationState>('state') ?? null
  }

  // 4. Timeout — mark failed if still waiting for webhooks
  override async alarm() {
    const state = await this.ctx.storage.get<GenerationState>('state')
    if (!state || state.status !== 'active') return

    state.status = 'failed'
    state.error = { code: 'timeout', received: state.outputs.length, expected: state.count }
    await this.ctx.storage.put('state', state)
  }
}

async function dummyDbInsert(data: unknown) {
  console.log('thanks for the data', data)
}
