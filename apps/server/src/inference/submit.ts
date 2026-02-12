import { v7 as uuidv7 } from 'uuid'

import type { Context } from '../context'
import { resolveAutoAspectRatio } from '../services/auto-aspect-ratio'
import type { Result } from '../utils/result'
import { getRequest } from './request'
import { httpError, type RequestError } from './result'
import type { ImageInferenceInput } from './schema'

const RUNWARE_API_URL = 'https://api.runware.ai/v1'

const aspectRatioDimensions = {
  landscape: { width: 1536, height: 1024 },
  portrait: { width: 1024, height: 1536 },
  square: { width: 1280, height: 1280 },
} as const

type SubmitArgs = {
  input: ImageInferenceInput
  tags?: Record<string, string | null>
}

export async function submitRequest(ctx: Context, args: SubmitArgs) {
  const input = { ...args.input }
  const annotations: Record<string, unknown> = {}

  if (input.width === undefined && input.height === undefined) {
    const ar = await resolveAutoAspectRatio(ctx, { prompt: input.positivePrompt })
    annotations.autoAspectRatio = ar
    if (ar.ok) {
      const dims = aspectRatioDimensions[ar.value.aspectRatio]
      input.width = dims.width
      input.height = dims.height
    }
  }

  const id = uuidv7()
  const webhookURL = `${ctx.env.PUBLIC_URL}/webhooks/runware?generation_id=${id}`

  const result = await dispatch({
    id,
    apiKey: ctx.env.RUNWARE_KEY,
    webhookURL,
    input,
  })

  const request = getRequest(ctx, id)
  await request.init({
    id,
    model: input.model,
    input: result.ok ? result.value.inferenceTask : {},
    outputFormat: input.outputFormat,
    expectedCount: input.numberResults,
    annotations,
    tags: args.tags,
    error: result.ok ? undefined : result.error,
  })

  if (!result.ok) {
    throw new Error(result.message)
  }

  return id
}

// -- Runware API dispatch --

type DispatchArgs = {
  id: string
  apiKey: string
  webhookURL: string
  input: ImageInferenceInput
}

async function dispatch(
  args: DispatchArgs,
): Promise<Result<{ inferenceTask: Record<string, unknown> }, RequestError>> {
  const inferenceTask = {
    taskType: 'imageInference' as const,
    taskUUID: args.id,
    ...args.input,
    width: args.input.width ?? 1280,
    height: args.input.height ?? 1280,
    outputType: 'URL' as const,
    includeCost: true,
    webhookURL: args.webhookURL,
  }

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

  return { ok: true, value: { inferenceTask } }
}
