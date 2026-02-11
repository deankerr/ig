/**
 * InferenceDO — Coordination-only Durable Object for inference requests.
 *
 * This DO is a state register. It tracks what happened (webhooks received, outputs processed)
 * but does no heavy I/O (no CDN fetches, no R2 uploads, no D1 writes).
 * All I/O happens at the Worker level via waitUntil.
 *
 * Storage: sync KV (ctx.storage.kv) with keys "gen" and "outputs".
 */

import { DurableObject } from 'cloudflare:workers'
import { z } from 'zod'

import type { Context } from '@/context'

import { output, timeoutError, type Output, type OutputResult, type RequestError } from './result'
import { imageInferenceWebhook, type ImageInferenceInput } from './schema'

const TIMEOUT_MS = 5 * 60 * 1000

// -- State types --

export type RequestMeta = {
  id: string
  model: string
  input: Record<string, unknown>
  outputFormat: ImageInferenceInput['outputFormat']
  expectedCount: number
  annotations: Record<string, unknown>
  error?: RequestError
  createdAt: number
  completedAt?: number
}

export type RequestState = RequestMeta & {
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
  error?: RequestError
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
  meta: RequestMeta
}

export type ConfirmResult = {
  complete: boolean
}

// -- Durable Object --

export class InferenceDO extends DurableObject<Env> {
  private get kv() {
    return this.ctx.storage.kv
  }

  private getMeta(): RequestMeta | undefined {
    return this.kv.get('gen')
  }

  private getOutputs(): Output[] {
    return this.kv.get('outputs') ?? []
  }

  /** Initialize request state. Called once after dispatch (success or failure). */
  async init(args: InitArgs) {
    const now = Date.now()
    const meta: RequestMeta = {
      id: args.id,
      model: args.model,
      input: args.input,
      outputFormat: args.outputFormat,
      expectedCount: args.expectedCount,
      annotations: args.annotations ?? {},
      createdAt: now,
    }

    if (args.error) {
      meta.error = args.error
      meta.completedAt = now
    }

    this.kv.put('gen', meta)
    this.kv.put('outputs', [])

    if (!args.error) {
      await this.ctx.storage.setAlarm(now + TIMEOUT_MS)
    }
  }

  /** Validate webhook payload, store raw data, return items for Worker to process. */
  recordWebhook(payload: unknown): RecordWebhookResult {
    const meta = this.getMeta()
    if (!meta) throw new Error('No request state')

    const now = Date.now()
    const outputs = this.getOutputs()
    const parsed = imageInferenceWebhook.safeParse(payload)

    if (!parsed.success) {
      outputs.push(output.validationError(z.flattenError(parsed.error), payload, now))
      this.kv.put('outputs', outputs)
      return { items: [], meta }
    }

    if ('errors' in parsed.data) {
      outputs.push(output.webhookError(parsed.data.errors, payload, now))
      this.kv.put('outputs', outputs)

      if (outputs.length >= meta.expectedCount) {
        meta.completedAt = Date.now()
        this.kv.put('gen', meta)
      }

      return { items: [], meta }
    }

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
    if (!meta) throw new Error('No request state')

    const outputs = this.getOutputs()
    outputs.push(...results)
    this.kv.put('outputs', outputs)

    if (outputs.length >= meta.expectedCount && !meta.completedAt) {
      meta.completedAt = Date.now()
      this.kv.put('gen', meta)
    }

    return { complete: !!meta.completedAt }
  }

  /** Record a request-level error (e.g. D1 projection failure). */
  setError(error: RequestError) {
    const meta = this.getMeta()
    if (!meta) return
    meta.error = error
    this.kv.put('gen', meta)
  }

  /** Read current state for client polling. */
  getState(): RequestState | null {
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
    meta.error = timeoutError(outputs.length, meta.expectedCount)
    this.kv.put('gen', meta)
  }
}

// -- Client --

/** RPC interface for InferenceDO. Typed separately because CF's Rpc.Provider
 *  collapses sync DO methods to `never`. This defines the actual RPC contract. */
type RequestClient = {
  init(args: InitArgs): Promise<void>
  recordWebhook(payload: unknown): Promise<RecordWebhookResult>
  confirmOutputs(results: OutputResult[]): Promise<ConfirmResult>
  setError(error: RequestError): Promise<void>
  getState(): Promise<RequestState | null>
}

export function getRequest(ctx: Context, id: string) {
  const ns = ctx.env.GENERATION_DO
  return ns.get(ns.idFromName(id)) as unknown as RequestClient
}
