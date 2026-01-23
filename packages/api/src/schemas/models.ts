import { z } from "zod"

export const listModelsInputSchema = z.object({
  category: z.string().optional(),
  kind: z.string().optional(),
  status: z.string().optional(),
  search: z.string().optional(),
  limit: z.number().int().min(1).max(100).optional().default(50),
  offset: z.number().int().min(0).optional().default(0),
})

export const getModelInputSchema = z.object({
  endpointId: z.string().min(1),
})
