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

import type { Context } from '../context'
import { REQUEST_TIMEOUT_MS } from './config'
import * as persist from './persist'
import { output, timeoutError, type Output, type RequestError } from './result'
import { imageInferenceWebhook, type ImageInferenceInput } from './schema'

// -- State types --

export type RequestMeta = {
  id: string
  model: string
  input: Record<string, unknown>
  batch: number
  error?: RequestError
  createdAt: Date
  completedAt?: Date

  annotations: Record<string, unknown>
  outputFormat: ImageInferenceInput['outputFormat']
  tags?: Record<string, string | null>
}

export type RequestState = RequestMeta & {
  outputs: Output[]
}

// -- RPC argument/return types --

export type InitArgs = Omit<RequestMeta, 'createdAt' | 'completedAt'>

export type SetDispatchArgs = {
  input: Record<string, unknown>
  annotations: Record<string, unknown>
  error?: RequestError
}

export type WebhookItem = {
  index: number
  imageURL: string
  seed: number
  cost?: number
  raw: Record<string, unknown>
}

export type RecordWebhookResult = {
  items: WebhookItem[]
  meta: RequestMeta
}

export type ConfirmResult = {
  complete: boolean
}

// -- Durable Object --

// DO storage keys — typed constants to avoid silent mismatches
const KV = { meta: 'meta', outputs: 'outputs' } as const

export class InferenceDO extends DurableObject<Env> {
  private get kv() {
    return this.ctx.storage.kv
  }

  private getMeta(): RequestMeta | undefined {
    return this.kv.get(KV.meta)
  }

  private getOutputs(): Output[] {
    return this.kv.get(KV.outputs) ?? []
  }

  /** Initialize request state. Called once after dispatch (success or failure). */
  async init(args: InitArgs) {
    const now = new Date()
    const meta: RequestMeta = {
      ...args,
      createdAt: now,
    }

    if (args.error) {
      meta.error = args.error
      meta.completedAt = now
    }

    this.kv.put(KV.meta, meta)
    this.kv.put(KV.outputs, [])

    if (!args.error) {
      await this.ctx.storage.setAlarm(now.getTime() + REQUEST_TIMEOUT_MS)
    }
  }

  /** Validate webhook payload, store raw data, return items for Worker to process. */
  recordWebhook(payload: unknown): RecordWebhookResult {
    const meta = this.getMeta()
    if (!meta) throw new Error('No request state')

    const now = new Date()
    const outputs = this.getOutputs()
    const parsed = imageInferenceWebhook.safeParse(payload)

    if (!parsed.success) {
      outputs.push(output.validationError(z.flattenError(parsed.error), payload, now))
      this.kv.put(KV.outputs, outputs)
      return { items: [], meta }
    }

    if ('errors' in parsed.data) {
      outputs.push(output.webhookError(parsed.data.errors, payload, now))
      this.kv.put(KV.outputs, outputs)

      if (outputs.length >= meta.batch) {
        meta.completedAt = new Date()
        this.kv.put(KV.meta, meta)
      }

      return { items: [], meta }
    }

    const items: WebhookItem[] = parsed.data.data.map((result, index) => ({
      index,
      imageURL: result.imageURL,
      seed: result.seed,
      cost: result.cost,
      raw: result as Record<string, unknown>,
    }))

    return { items, meta }
  }

  /** Record processed output results from the Worker. */
  confirmOutputs(results: Output[]): ConfirmResult {
    const meta = this.getMeta()
    if (!meta) throw new Error('No request state')

    const outputs = this.getOutputs()
    outputs.push(...results)
    this.kv.put(KV.outputs, outputs)

    if (outputs.length >= meta.batch && !meta.completedAt) {
      meta.completedAt = new Date()
      this.kv.put(KV.meta, meta)
    }

    return { complete: !!meta.completedAt }
  }

  /** Record a request-level error (e.g. D1 projection failure). */
  setError(error: RequestError) {
    const meta = this.getMeta()
    if (!meta) return
    meta.error = error
    this.kv.put(KV.meta, meta)
  }

  /** Update request with dispatch result. Called after background dispatch completes. */
  setDispatchResult(args: SetDispatchArgs) {
    const meta = this.getMeta()
    if (!meta) return

    meta.input = args.input
    meta.annotations = args.annotations
    if (args.error) {
      meta.error = args.error
      meta.completedAt = new Date()
    }
    this.kv.put(KV.meta, meta)
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
    const now = new Date()
    meta.completedAt = now
    meta.error = timeoutError(outputs.length, meta.batch)
    this.kv.put(KV.meta, meta)

    // Persist timeout to D1
    await persist.failGeneration(this.env.DB, {
      id: meta.id,
      error: `[timeout] received ${outputs.length}/${meta.batch}`,
      completedAt: now,
      model: meta.model,
      input: meta.input,
      batch: meta.batch,
      createdAt: meta.createdAt,
    })
  }
}

// -- Client --

/** RPC interface for InferenceDO. Typed separately because CF's Rpc.Provider
 *  collapses sync DO methods to `never`. This defines the actual RPC contract. */
type RequestClient = {
  init(args: InitArgs): Promise<void>
  setDispatchResult(args: SetDispatchArgs): Promise<void>
  recordWebhook(payload: unknown): Promise<RecordWebhookResult>
  confirmOutputs(results: Output[]): Promise<ConfirmResult>
  setError(error: RequestError): Promise<void>
  getState(): Promise<RequestState | null>
}

export function getRequest(ctx: Context, id: string) {
  const ns = ctx.env.GENERATION_DO
  return ns.get(ns.idFromName(id)) as unknown as RequestClient
}
