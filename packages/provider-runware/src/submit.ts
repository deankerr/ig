/**
 * Runware API submission
 *
 * Submits inference requests to the Runware REST API.
 * https://runware.ai/docs/en/getting-started/how-to-connect
 */

const RUNWARE_API_URL = "https://api.runware.ai/v1"

export type TaskType = "imageInference" | "videoInference"

export type SubmitOptions = {
  apiKey: string
  taskType: TaskType
  taskUUID: string
  input: Record<string, unknown>
  webhookUrl?: string
}

export type SubmitResult = {
  requestId: string
}

type RunwareAuthTask = {
  taskType: "authentication"
  apiKey: string
}

type RunwareInferenceTask = {
  taskType: TaskType
  taskUUID: string
  webhookURL?: string
  includeCost?: boolean
  [key: string]: unknown
}

type RunwareResponse = {
  data?: Array<{ taskType: string; taskUUID: string; [key: string]: unknown }>
  error?: string
}

/**
 * Submits an inference request to Runware
 *
 * The input object should contain the Runware-specific parameters for the task type.
 * Common parameters for imageInference: positivePrompt, model, width, height, steps, etc.
 */
export async function submit(options: SubmitOptions): Promise<SubmitResult> {
  const { apiKey, taskType, taskUUID, input, webhookUrl } = options

  // Build the request payload
  // Runware accepts an array of tasks, with auth as first element
  const authTask: RunwareAuthTask = {
    taskType: "authentication",
    apiKey,
  }

  const inferenceTask: RunwareInferenceTask = {
    taskType,
    taskUUID,
    includeCost: true,
    ...input,
  }

  if (webhookUrl) {
    inferenceTask.webhookURL = webhookUrl
  }

  const response = await fetch(RUNWARE_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify([authTask, inferenceTask]),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Runware API error: ${response.status} ${text}`)
  }

  const result = (await response.json()) as RunwareResponse

  if (result.error) {
    throw new Error(`Runware API error: ${result.error}`)
  }

  // With webhook, we get immediate acknowledgment
  // The actual result will come via webhook
  // Runware uses our taskUUID as the request ID
  return { requestId: taskUUID }
}
