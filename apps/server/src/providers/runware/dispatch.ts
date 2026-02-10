/**
 * Dispatch an image inference request to the Runware API.
 * Runs at the Worker level — the DO only stores the result.
 */

import type { GenerationError } from './generationDo'
import type { ImageInferenceInput } from './schemas'

const RUNWARE_API_URL = 'https://api.runware.ai/v1'

type DispatchArgs = {
  id: string
  apiKey: string
  webhookURL: string
  input: ImageInferenceInput
}

type DispatchSuccess = {
  ok: true
  inferenceTask: Record<string, unknown>
}

type DispatchFailure = {
  ok: false
  error: GenerationError
  message: string
}

type DispatchResult = DispatchSuccess | DispatchFailure

export async function dispatchToRunware(args: DispatchArgs): Promise<DispatchResult> {
  const inferenceTask = {
    taskType: 'imageInference' as const,
    taskUUID: args.id,
    ...args.input,
    width: args.input.width ?? 1024,
    height: args.input.height ?? 1024,
    outputType: 'URL' as const,
    includeCost: true,
    webhookURL: args.webhookURL,
  }

  const response = await fetch(RUNWARE_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify([{ taskType: 'authentication', apiKey: args.apiKey }, inferenceTask]),
  })

  // HTTP-level failure
  if (!response.ok) {
    return {
      ok: false,
      error: {
        code: 'http_error',
        url: RUNWARE_API_URL,
        status: response.status,
        body: await response.text(),
      },
      message: `Runware API error: ${response.status}`,
    }
  }

  // Application-level rejection
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

  return { ok: true, inferenceTask }
}
