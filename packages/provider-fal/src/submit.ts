/**
 * fal.ai submission
 *
 * Submits inference requests to fal.ai's queue API.
 */

import { fal } from "@fal-ai/client"

export type SubmitOptions = {
  apiKey: string
  endpoint: string
  input: Record<string, unknown>
  webhookUrl: string
}

export type SubmitResult = {
  requestId: string
}

/**
 * Submits an inference request to fal.ai
 */
export async function submit(options: SubmitOptions): Promise<SubmitResult> {
  const { apiKey, endpoint, input, webhookUrl } = options

  fal.config({ credentials: apiKey })

  const result = await fal.queue.submit(endpoint, {
    input,
    webhookUrl,
  })

  return { requestId: result.request_id }
}
