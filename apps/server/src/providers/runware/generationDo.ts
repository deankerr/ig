/**
 * GenerationDO — Coordination-only Durable Object for image generation requests.
 *
 * This DO is a state register. It tracks what happened (webhooks received, outputs processed)
 * but does no heavy I/O (no CDN fetches, no R2 uploads, no D1 writes).
 * All I/O happens at the Worker level via waitUntil.
 *
 * Storage: sync KV (ctx.storage.kv) with keys "gen" and "outputs".
 */

import { DurableObject } from 'cloudflare:workers'
import { z } from 'zod'

import type { SerializedError } from '../../utils/error'
import { type ImageInferenceInput, type RunwareError, imageInferenceWebhook } from './schemas'

const TIMEOUT_MS = 5 * 60 * 1000

// -- Generation-level errors --

type HttpError = { code: 'http_error' | 'fetch_failed'; url: string; status: number; body: string }
type ApiRejection = { code: 'api_rejected'; errors: RunwareError[] }
type TimeoutError = { code: 'timeout'; received: number; expected: number }
type DispatchError = HttpError | ApiRejection
export type GenerationError = DispatchError | TimeoutError

// -- Per-output errors --

type FlatError = { formErrors: string[]; fieldErrors: Record<string, string[] | undefined> }
type ValidationError = { code: 'validation'; issues: FlatError }
type WebhookError = { code: 'webhook_error'; errors: RunwareError[] }
type StorageError = { code: 'storage_failed'; r2Key: string; cause: SerializedError }
type FetchError = { code: 'fetch_failed'; url: string; status: number; body: string }
export type OutputErrorDetail = ValidationError | WebhookError | FetchError | StorageError

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

// -- DO state stored in sync KV --

export type GenerationMeta = {
  id: string
  model: string
  input: Record<string, unknown>
  outputFormat: ImageInferenceInput['outputFormat']
  expectedCount: number
  error?: GenerationError
  createdAt: number
  completedAt?: number
}

// -- RPC argument/return types --

export type InitArgs = {
  id: string
  model: string
  input: Record<string, unknown>
  outputFormat: ImageInferenceInput['outputFormat']
  expectedCount: number
  error?: DispatchError
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

export type GenerationState = GenerationMeta & {
  outputs: Output[]
}

// -- Durable Object --

export class GenerationDO extends DurableObject<Env> {
  // Sync KV — reads are synchronous, no constructor hydration needed.
  private get kv() {
    return this.ctx.storage.kv
  }

  private getMeta(): GenerationMeta | undefined {
    return this.kv.get('gen')
  }

  private getOutputs(): Output[] {
    return this.kv.get('outputs') ?? []
  }

  /** Initialize generation state. Called once after dispatch (success or failure). */
  async init(args: InitArgs) {
    const now = Date.now()
    const meta: GenerationMeta = {
      id: args.id,
      model: args.model,
      input: args.input,
      outputFormat: args.outputFormat,
      expectedCount: args.expectedCount,
      createdAt: now,
    }

    // If dispatch already failed, record it as complete with error
    if (args.error) {
      meta.error = args.error
      meta.completedAt = now
    }

    this.kv.put('gen', meta)
    this.kv.put('outputs', [])

    // Set timeout alarm (only if not already failed)
    if (!args.error) {
      await this.ctx.storage.setAlarm(now + TIMEOUT_MS)
    }
  }

  /** Validate webhook payload, store raw data, return items for Worker to process. */
  recordWebhook(payload: unknown): RecordWebhookResult {
    const meta = this.getMeta()
    if (!meta) throw new Error('No generation state')

    const now = Date.now()
    const outputs = this.getOutputs()
    const parsed = imageInferenceWebhook.safeParse(payload)

    // Validation failure — record error output inline
    if (!parsed.success) {
      const error: ValidationError = { code: 'validation', issues: z.flattenError(parsed.error) }
      outputs.push({ type: 'error', error, raw: payload, createdAt: now })
      this.kv.put('outputs', outputs)
      return { items: [], meta }
    }

    // Runware reported an error for this task
    if ('errors' in parsed.data) {
      const error: WebhookError = { code: 'webhook_error', errors: parsed.data.errors }
      outputs.push({ type: 'error', error, raw: payload, createdAt: now })
      this.kv.put('outputs', outputs)

      // Check completion (error outputs count toward total)
      if (outputs.length >= meta.expectedCount) {
        meta.completedAt = Date.now()
        this.kv.put('gen', meta)
      }

      return { items: [], meta }
    }

    // Success — return items for Worker-level processing
    const items: PendingItem[] = parsed.data.data.map((result, index) => ({
      index,
      imageURL: result.imageURL,
      seed: result.seed,
      cost: result.cost,
      raw: result as Record<string, unknown>,
    }))

    return { items, meta }
  }

  /** Record processed output results from the Worker. */
  confirmOutputs(results: OutputResult[]): ConfirmResult {
    const meta = this.getMeta()
    if (!meta) throw new Error('No generation state')

    const outputs = this.getOutputs()
    outputs.push(...results)
    this.kv.put('outputs', outputs)

    // Check completion
    if (outputs.length >= meta.expectedCount && !meta.completedAt) {
      meta.completedAt = Date.now()
      this.kv.put('gen', meta)
    }

    return { complete: !!meta.completedAt }
  }

  /** Read current state for client polling. */
  getState(): GenerationState | null {
    const meta = this.getMeta()
    if (!meta) return null
    return { ...meta, outputs: this.getOutputs() }
  }

  /** Timeout — mark failed if still waiting for webhooks. */
  override async alarm() {
    const meta = this.getMeta()
    if (!meta || meta.completedAt) return

    const outputs = this.getOutputs()
    meta.completedAt = Date.now()
    meta.error = {
      code: 'timeout',
      received: outputs.length,
      expected: meta.expectedCount,
    }
    this.kv.put('gen', meta)
  }
}
