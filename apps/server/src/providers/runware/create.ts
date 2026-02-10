import { v7 as uuidv7 } from 'uuid'

import type { Context } from '../../context'
import type { Result } from '../../utils/result'
import type { GenerationError } from './errors'
import { httpError } from './errors'
import type { ImageInferenceInput } from './schemas'
import { getGenerationStub } from './stub'

const RUNWARE_API_URL = 'https://api.runware.ai/v1'

export async function createGeneration(ctx: Context, args: { input: ImageInferenceInput }) {
  const id = uuidv7()
  const webhookURL = `${ctx.env.PUBLIC_URL}/webhooks/runware?generation_id=${id}`

  const result = await dispatch({
    id,
    apiKey: ctx.env.RUNWARE_KEY,
    webhookURL,
    input: args.input,
  })

  const stub = getGenerationStub(ctx, id)
  await stub.init({
    id,
    model: args.input.model,
    input: result.ok ? result.value.inferenceTask : {},
    outputFormat: args.input.outputFormat,
    expectedCount: args.input.numberResults,
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
): Promise<Result<{ inferenceTask: Record<string, unknown> }, GenerationError>> {
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

  if (!response.ok) {
    return {
      ok: false,
      error: httpError('http_error', RUNWARE_API_URL, response.status, await response.text()),
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
