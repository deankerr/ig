/**
 * Runware API submission
 *
 * Submits inference requests to the Runware REST API.
 * https://runware.ai/docs/en/getting-started/how-to-connect
 */

const RUNWARE_API_URL = "https://api.runware.ai/v1"

export type SubmitOptions = {
  apiKey: string
  input: Record<string, unknown>
}

type RunwareAuthTask = {
  taskType: "authentication"
  apiKey: string
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
export async function submit({ apiKey, input }: SubmitOptions) {
  // Build the request payload
  // Runware accepts an array of tasks, with auth as first element
  const authTask: RunwareAuthTask = {
    taskType: "authentication",
    apiKey,
  }

  // helpful defaults/fal mappings
  // TODO capture in generation record
  input.taskType ??= "imageInference"
  input.positivePrompt ??= input.prompt
  input.includeCost ??= true
  input.width ??= 1024
  input.height ??= 1024

  const response = await fetch(RUNWARE_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify([authTask, input]),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Runware API error: ${response.status} ${text}`)
  }

  const result = (await response.json()) as RunwareResponse

  if (result.error) {
    throw new Error(`Runware API error: ${result.error}`)
  }
}
