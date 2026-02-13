import { v7 as uuidv7 } from 'uuid'

import type { Context } from '../context'
import { resolveAutoAspectRatio } from '../services/auto-aspect-ratio'
import type { Result } from '../utils/result'
import { getRequest, type RequestMeta } from './request'
import { httpError, type OutputResult, type OutputSuccess, type RequestError } from './result'
import {
  getContentType,
  imageInferenceWebhook,
  type ImageInferenceInput,
  type ImageInferenceResult,
} from './schema'
import { processItem, persistToD1 } from './webhook'

const RUNWARE_API_URL = 'https://api.runware.ai/v1'

const aspectRatioDimensions = {
  landscape: { width: 1536, height: 1024 },
  portrait: { width: 1024, height: 1536 },
  square: { width: 1280, height: 1280 },
} as const

type SubmitArgs = {
  input: ImageInferenceInput
  tags?: Record<string, string | null>
  sync?: boolean
}

export type SyncResult = {
  id: string
  generation: {
    id: string
    model: string
    input: Record<string, unknown>
    artifactCount: number
    createdAt: Date
    completedAt: Date
  }
  artifacts: Array<{
    id: string
    generationId: string
    model: string
    r2Key: string
    contentType: string
    width: number | null
    height: number | null
    seed: number
    cost: number | undefined
    metadata: Record<string, unknown>
    createdAt: Date
  }>
}

export type SubmitResult = { id: string } | SyncResult

export async function submitRequest(ctx: Context, args: SubmitArgs): Promise<SubmitResult> {
  const id = uuidv7()

  if (args.sync) {
    return submitSync(ctx, { id, input: args.input, tags: args.tags })
  }

  return submitAsync(ctx, { id, input: args.input, tags: args.tags })
}

// -- Async path: return ID immediately, dispatch in background --

async function submitAsync(
  ctx: Context,
  args: { id: string; input: ImageInferenceInput; tags?: Record<string, string | null> },
): Promise<{ id: string }> {
  const { id, input, tags } = args

  // Init DO with minimal state — model, format, count are known upfront
  const request = getRequest(ctx, id)
  await request.init({
    id,
    model: input.model,
    outputFormat: input.outputFormat,
    expectedCount: input.numberResults,
    tags,
  })

  // Push autoAspectRatio + dispatch to background
  ctx.waitUntil(backgroundDispatch(ctx, { id, input }))

  console.log('[inference:submitAsync] returning immediately', { id })
  return { id }
}

async function backgroundDispatch(ctx: Context, args: { id: string; input: ImageInferenceInput }) {
  const { id } = args
  const input = { ...args.input }
  const annotations: Record<string, unknown> = {}
  const request = getRequest(ctx, id)

  try {
    // Auto aspect ratio classification
    if (input.width === undefined && input.height === undefined) {
      const ar = await resolveAutoAspectRatio(ctx, { prompt: input.positivePrompt })
      annotations.autoAspectRatio = ar
      if (ar.ok) {
        const dims = aspectRatioDimensions[ar.value.aspectRatio]
        input.width = dims.width
        input.height = dims.height
      }
    }

    // Dispatch to Runware with async delivery (fast ack, results via webhook)
    const webhookURL = `${ctx.env.PUBLIC_URL}/webhooks/runware?generation_id=${id}`
    const result = await dispatch({
      id,
      apiKey: ctx.env.RUNWARE_KEY,
      webhookURL,
      deliveryMethod: 'async',
      input,
    })

    // Update DO with dispatch outcome
    await request.setDispatchResult({
      input: result.ok ? result.value.inferenceTask : {},
      annotations,
      error: result.ok ? undefined : result.error,
    })

    console.log('[inference:backgroundDispatch]', { id, ok: result.ok })
  } catch (err) {
    // Ensure DO gets an error state so the alarm doesn't wait 5 minutes
    console.error('[inference:backgroundDispatch] unexpected error', { id, error: err })
    await request.setDispatchResult({
      input: {},
      annotations,
      error: httpError(RUNWARE_API_URL, 0, String(err)),
    })
  }
}

// -- Sync path: block until complete, return full result --

async function submitSync(
  ctx: Context,
  args: { id: string; input: ImageInferenceInput; tags?: Record<string, string | null> },
): Promise<SyncResult> {
  const { id, input: rawInput, tags } = args
  const input = { ...rawInput }
  const annotations: Record<string, unknown> = {}

  // Auto aspect ratio (blocking — sync mode waits by design)
  if (input.width === undefined && input.height === undefined) {
    const ar = await resolveAutoAspectRatio(ctx, { prompt: input.positivePrompt })
    annotations.autoAspectRatio = ar
    if (ar.ok) {
      const dims = aspectRatioDimensions[ar.value.aspectRatio]
      input.width = dims.width
      input.height = dims.height
    }
  }

  // Dispatch without webhook — Runware defaults to sync delivery
  const result = await dispatch({ id, apiKey: ctx.env.RUNWARE_KEY, input })

  if (!result.ok) {
    throw new Error(result.message)
  }

  // Filter for inference results (body.data also contains the auth ack)
  const inferenceData = result.value.data.filter(
    (item) => (item as Record<string, unknown>).taskType === 'imageInference',
  )
  const parsed = imageInferenceWebhook.safeParse({ data: inferenceData })
  if (!parsed.success || 'errors' in parsed.data) {
    throw new Error('Sync dispatch returned invalid or errored data')
  }

  const items = parsed.data.data.map((r: ImageInferenceResult, index: number) => ({
    index,
    imageURL: r.imageURL,
    seed: r.seed,
    cost: r.cost,
    raw: r as unknown as Record<string, unknown>,
  }))

  const now = Date.now()
  const contentType = getContentType(input.outputFormat)
  const meta: RequestMeta = {
    id,
    model: input.model,
    input: result.value.inferenceTask,
    outputFormat: input.outputFormat,
    expectedCount: input.numberResults,
    annotations,
    tags,
    createdAt: now,
  }

  // Process items inline (CDN fetch → R2 upload)
  const outputs: OutputResult[] = []
  for (const item of items) {
    const r = await processItem(ctx, { item, contentType, now })
    outputs.push(r)
  }

  // Write DO state for consistency
  const request = getRequest(ctx, id)
  await request.init({
    id,
    model: input.model,
    input: result.value.inferenceTask,
    outputFormat: input.outputFormat,
    expectedCount: input.numberResults,
    annotations,
    tags,
  })
  await request.confirmOutputs(outputs)

  // Persist to D1
  const state = await request.getState()
  if (state) await persistToD1(ctx, { generationId: id, meta, state })

  // Build response
  const successes = outputs.filter((o): o is OutputSuccess => o.type === 'success')
  const inputObj = meta.input as Record<string, unknown>
  const width = typeof inputObj.width === 'number' ? inputObj.width : null
  const height = typeof inputObj.height === 'number' ? inputObj.height : null
  const completedAt = state?.completedAt ?? now

  console.log('[inference:submitSync]', { id, artifacts: successes.length })

  return {
    id,
    generation: {
      id,
      model: meta.model,
      input: meta.input,
      artifactCount: successes.length,
      createdAt: new Date(meta.createdAt),
      completedAt: new Date(completedAt),
    },
    artifacts: successes.map((o) => ({
      id: o.id,
      generationId: id,
      model: meta.model,
      r2Key: o.r2Key,
      contentType: o.contentType,
      width,
      height,
      seed: o.seed,
      cost: o.cost,
      metadata: o.metadata,
      createdAt: new Date(o.createdAt),
    })),
  }
}

// -- Runware API dispatch --

type DispatchArgs = {
  id: string
  apiKey: string
  webhookURL?: string
  deliveryMethod?: 'sync' | 'async'
  input: ImageInferenceInput
}

type DispatchResult = {
  inferenceTask: Record<string, unknown>
  data: unknown[]
}

async function dispatch(args: DispatchArgs): Promise<Result<DispatchResult, RequestError>> {
  const inferenceTask: Record<string, unknown> = {
    taskType: 'imageInference',
    taskUUID: args.id,
    ...args.input,
    width: args.input.width ?? 1280,
    height: args.input.height ?? 1280,
    outputType: 'URL',
    includeCost: true,
  }

  if (args.webhookURL) inferenceTask.webhookURL = args.webhookURL
  if (args.deliveryMethod) inferenceTask.deliveryMethod = args.deliveryMethod

  const response = await fetch(RUNWARE_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify([{ taskType: 'authentication', apiKey: args.apiKey }, inferenceTask]),
  })

  if (!response.ok) {
    return {
      ok: false,
      error: httpError(RUNWARE_API_URL, response.status, await response.text()),
      message: `Runware API error: ${response.status}`,
    }
  }

  const body = (await response.json()) as {
    data?: unknown[]
    errors?: Array<{ code: string; message: string }>
  }
  if (body.errors?.length) {
    return {
      ok: false,
      error: { code: 'api_rejected', errors: body.errors },
      message: `Runware error: ${body.errors.map((e) => e.message).join(', ')}`,
    }
  }

  return { ok: true, value: { inferenceTask, data: body.data ?? [] } }
}
