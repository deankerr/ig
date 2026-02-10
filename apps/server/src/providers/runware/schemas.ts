/**
 * Zod schemas for Runware payloads.
 * Key names match Runware's API exactly — no renaming.
 */

import { z } from 'zod'

// -- Input schemas --

const loraSchema = z.object({
  model: z.string(),
  weight: z.number(),
})

export const imageInferenceInput = z.object({
  model: z.string().min(1),
  positivePrompt: z.string().min(1),
  negativePrompt: z.string().optional(),
  width: z.number().int().optional(),
  height: z.number().int().optional(),
  steps: z.number().int().optional(),
  scheduler: z.string().optional(),
  seed: z.number().int().optional(),
  CFGScale: z.number().optional(),
  clipSkip: z.number().int().optional(),
  strength: z.number().optional(),
  seedImage: z.string().optional(),
  maskImage: z.string().optional(),
  outputFormat: z.enum(['JPG', 'PNG', 'WEBP']).optional().default('JPG'),
  checkNSFW: z.boolean().optional(),
  promptWeighting: z.enum(['compel', 'sdEmbeds']).optional(),
  lora: z.array(loraSchema).optional(),
  numberResults: z.number().int().min(1).max(10).optional().default(1),
})

export type ImageInferenceInput = z.infer<typeof imageInferenceInput>

// -- Webhook schemas --

export const imageInferenceResult = z.object({
  taskType: z.literal('imageInference'),
  taskUUID: z.string(),
  imageUUID: z.string(),
  imageURL: z.string(),
  seed: z.number(),
  cost: z.number().optional(),
})

export type ImageInferenceResult = z.infer<typeof imageInferenceResult>

const runwareError = z.looseObject({ code: z.string(), message: z.string() })

export type RunwareError = z.infer<typeof runwareError>

export const imageInferenceWebhook = z.union([
  z.object({ data: z.array(imageInferenceResult).min(1) }),
  z.object({ errors: z.array(runwareError).min(1) }),
])

// -- Legacy schemas (used by resolve.ts for the old webhook flow) --

export const RunwareDataSchema = z.object({
  taskUUID: z.string().optional(),
  imageURL: z.string().optional(),
  imageBase64Data: z.string().optional(),
  imageDataURI: z.string().optional(),
  videoURL: z.string().optional(),
  audioURL: z.string().optional(),
  audioBase64Data: z.string().optional(),
  audioDataURI: z.string().optional(),
  seed: z.number().optional(),
  cost: z.number().optional(),
})

export const RunwareWebhookSchema = z.union([
  z.object({ data: z.array(RunwareDataSchema).min(1) }),
  z.object({ error: z.unknown() }),
])

// -- Helpers --

const outputFormatContentType = {
  JPG: 'image/jpeg',
  PNG: 'image/png',
  WEBP: 'image/webp',
} as const

export function getContentType(format: ImageInferenceInput['outputFormat']) {
  return outputFormatContentType[format]
}
