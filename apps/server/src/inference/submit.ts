import type { Artifact, Generation } from '@ig/db/schema'
import { v7 as uuidv7 } from 'uuid'

import type { Context } from '../context'
import { dimensionsService, type DimensionsConfig } from '../services/dimensions'
import { dispatch, RUNWARE_API_URL } from './dispatch'
import * as persist from './persist'
import { getRequest, type RequestMeta } from './request'
import { httpError, type Output, type OutputSuccess } from './result'
import {
  getContentType,
  imageInferenceWebhook,
  type ImageInferenceInput,
  type ImageInferenceResult,
} from './schema'
import { storeArtifact } from './store'

type SubmitArgs = {
  input: ImageInferenceInput
  dimensions: DimensionsConfig
  tags?: Record<string, string | null>
  sync?: boolean
}

export type SyncResult = {
  id: string
  generation: Omit<Generation, 'error' | 'metadata'>
  artifacts: (Omit<Artifact, 'metadata' | 'deletedAt'> & { tags: Record<string, string | null> })[]
}

export type SubmitResult = { id: string } | SyncResult

export async function submitRequest(ctx: Context, args: SubmitArgs): Promise<SubmitResult> {
  const id = uuidv7()

  if (args.sync) {
    return submitSync(ctx, { id, input: args.input, dimensions: args.dimensions, tags: args.tags })
  }

  return submitAsync(ctx, { id, input: args.input, dimensions: args.dimensions, tags: args.tags })
}

// -- Async path: return ID immediately, dispatch in background --

async function submitAsync(
  ctx: Context,
  args: {
    id: string
    input: ImageInferenceInput
    dimensions: DimensionsConfig
    tags?: Record<string, string | null>
  },
): Promise<{ id: string }> {
  const { id, input, dimensions, tags } = args
  const now = new Date()

  // Init DO state — input is pre-dispatch, updated after backgroundDispatch completes
  const request = getRequest(ctx, id)
  await request.init({
    id,
    model: input.model,
    input: { ...input },
    outputFormat: input.outputFormat,
    batch: input.numberResults,
    annotations: {},
    tags,
  })

  // Progressive D1 projection — generation row appears immediately
  ctx.waitUntil(
    persist.insertGeneration(ctx.env.DATABASE, {
      id,
      model: input.model,
      input: { ...input },
      batch: input.numberResults,
      createdAt: now,
    }),
  )

  // Push dimensions + dispatch to background
  ctx.waitUntil(backgroundDispatch(ctx, { id, input, dimensions }))

  console.log('[inference:submitAsync] returning immediately', { id })
  return { id }
}

async function backgroundDispatch(
  ctx: Context,
  args: { id: string; input: ImageInferenceInput; dimensions: DimensionsConfig },
) {
  const { id } = args
  const input = { ...args.input }
  const annotations: Record<string, unknown> = {}
  const request = getRequest(ctx, id)

  try {
    // Resolve output dimensions
    const dims = await dimensionsService.resolve(ctx, {
      input,
      config: args.dimensions,
    })
    annotations.dimensions = dims
    input.width = dims.width
    input.height = dims.height

    // Dispatch to Runware with async delivery (fast ack, results via webhook)
    const webhookURL = `${ctx.env.PUBLIC_URL}/webhooks/runware?generation_id=${id}`
    const result = await dispatch({
      id,
      apiKey: ctx.env.RUNWARE_KEY,
      webhookURL,
      deliveryMethod: 'async',
      input,
    })

    // Update DO with dispatch outcome (use inferenceTask on success, resolved input on failure)
    await request.setDispatchResult({
      input: result.ok ? result.value.inferenceTask : { ...input },
      annotations,
      error: result.ok ? undefined : result.error,
    })

    // On dispatch failure, mark D1 generation as failed
    if (!result.ok) {
      const now = new Date()
      await persist.failGeneration(ctx.env.DATABASE, {
        id,
        error: `[dispatch] ${result.message}`,
        completedAt: now,
        model: input.model,
        input: { ...input },
        batch: input.numberResults,
        createdAt: now,
      })
    }

    console.log('[inference:backgroundDispatch]', { id, ok: result.ok })
  } catch (err) {
    // Ensure DO gets an error state so the alarm doesn't wait 5 minutes
    console.error('[inference:backgroundDispatch] unexpected error', { id, error: err })
    await request.setDispatchResult({
      input: { ...input },
      annotations,
      error: httpError(RUNWARE_API_URL, 0, String(err)),
    })

    // Mark D1 generation as failed
    const now = new Date()
    await persist.failGeneration(ctx.env.DATABASE, {
      id,
      error: `[dispatch] ${String(err)}`,
      completedAt: now,
      model: input.model,
      input: { ...input },
      batch: input.numberResults,
      createdAt: now,
    })
  }
}

// -- Sync path: block until complete, return full result --

async function submitSync(
  ctx: Context,
  args: {
    id: string
    input: ImageInferenceInput
    dimensions: DimensionsConfig
    tags?: Record<string, string | null>
  },
): Promise<SyncResult> {
  const { id, input: rawInput, dimensions, tags } = args
  const input = { ...rawInput }
  const annotations: Record<string, unknown> = {}
  const now = new Date()

  // Resolve output dimensions
  const dims = await dimensionsService.resolve(ctx, {
    input,
    config: dimensions,
  })
  annotations.dimensions = dims
  input.width = dims.width
  input.height = dims.height

  // Dispatch without webhook — Runware defaults to sync delivery
  const result = await dispatch({ id, apiKey: ctx.env.RUNWARE_KEY, input })

  if (!result.ok) {
    throw new Error(result.message, { cause: result.error })
  }

  // Progressive D1 — insert generation row
  await persist.insertGeneration(ctx.env.DATABASE, {
    id,
    model: input.model,
    input: result.value.inferenceTask,
    batch: input.numberResults,
    createdAt: now,
  })

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

  const contentType = getContentType(input.outputFormat)
  const meta: RequestMeta = {
    id,
    model: input.model,
    input: result.value.inferenceTask,
    outputFormat: input.outputFormat,
    batch: input.numberResults,
    annotations,
    tags,
    createdAt: now,
  }

  // Process items inline (CDN fetch → R2 upload) + progressive D1 artifact writes
  const outputs: Output[] = []
  for (const item of items) {
    const r = await storeArtifact(ctx, { item, contentType, now })
    outputs.push(r)

    // Insert artifact to D1 as it arrives
    if (r.type === 'success') {
      await persist.insertArtifact(ctx.env.DATABASE, {
        artifact: r,
        generationId: id,
        model: meta.model,
        input: meta.input,
        tags: meta.tags,
      })
    }
  }

  // Write DO state for consistency
  const request = getRequest(ctx, id)
  await request.init({
    id,
    model: input.model,
    input: result.value.inferenceTask,
    outputFormat: input.outputFormat,
    batch: input.numberResults,
    annotations,
    tags,
  })
  await request.confirmOutputs(outputs)

  // Complete the D1 generation
  const state = await request.getState()
  const completedAt = state?.completedAt ?? new Date()
  await persist.completeGeneration(ctx.env.DATABASE, { id, completedAt })

  // Build response
  const successes = outputs.filter((o): o is OutputSuccess => o.type === 'success')
  const inputObj = meta.input as Record<string, unknown>
  const width = typeof inputObj.width === 'number' ? inputObj.width : null
  const height = typeof inputObj.height === 'number' ? inputObj.height : null

  console.log('[inference:submitSync]', { id, artifacts: successes.length })

  return {
    id,
    generation: {
      id,
      model: meta.model,
      input: meta.input,
      batch: meta.batch,
      createdAt: meta.createdAt,
      completedAt,
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
      cost: o.cost ?? null,
      createdAt: o.createdAt,
      tags: meta.tags ?? {},
    })),
  }
}
