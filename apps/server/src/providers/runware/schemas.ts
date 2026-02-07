/**
 * Zod schemas for Runware webhook payloads.
 * Uses looseObject to extract what we need while preserving everything else.
 *
 * export type IOutputFormat = "JPG" | "PNG" | "WEBP";
 * export type IVideoOutputFormat = "MP4" | "WEBM" | "MOV";
 * export type IAudioOutputFormat = "MP3"
 */

import { z } from 'zod'

export const RunwareDataSchema = z.looseObject({
  taskUUID: z.string(),
  audioURL: z.string().optional(),
  audioBase64Data: z.string().optional(),
  audioDataURI: z.string().optional(),
  imageURL: z.string().optional(),
  imageBase64Data: z.string().optional(),
  imageDataURI: z.string().optional(),
  videoURL: z.string().optional(),
})

/**
 * Webhook wrapper - data is always an array.
 */
export const RunwareWebhookSchema = z.union([
  z.object({
    data: z.array(RunwareDataSchema),
  }),
  z.object({
    error: z.looseObject({
      message: z.string().default('[Unknown Error]'),
    }),
  }),
])
