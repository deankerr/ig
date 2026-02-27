// Runware API dispatch — builds and sends the inference request.

import type { Result } from '../utils/result'
import { httpError, type RequestError } from './result'
import type { ImageInferenceInput } from './schema'

export const RUNWARE_API_URL = 'https://api.runware.ai/v1'

type DispatchArgs = {
  id: string
  apiKey: string
  webhookURL?: string
  deliveryMethod?: 'sync' | 'async'
  input: ImageInferenceInput
}

export type DispatchResult = {
  inferenceTask: Record<string, unknown>
  data: unknown[]
}

export async function dispatch(args: DispatchArgs): Promise<Result<DispatchResult, RequestError>> {
  const inferenceTask: Record<string, unknown> = {
    taskType: 'imageInference',
    taskUUID: args.id,
    ...args.input,
    width: args.input.width ?? 1024,
    height: args.input.height ?? 1024,
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
