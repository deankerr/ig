import { z } from "zod";

export const createArtifactInputSchema = z.object({
  endpoint: z.string().min(1),
  input: z.record(z.string(), z.unknown()),
  tags: z.array(z.string()).optional().default([]),
});

export const listArtifactsQuerySchema = z.object({
  status: z.enum(["creating", "ready", "failed"]).optional(),
  endpoint: z.string().optional(),
  tags: z.array(z.string()).optional(),
  limit: z.number().int().min(1).max(100).optional().default(20),
  cursor: z.string().optional(),
});

export const updateTagsInputSchema = z.object({
  id: z.string().min(1),
  add: z.array(z.string()).optional().default([]),
  remove: z.array(z.string()).optional().default([]),
});

export const getArtifactInputSchema = z.object({
  id: z.string().min(1),
});

export const deleteArtifactInputSchema = z.object({
  id: z.string().min(1),
});

export const retryArtifactInputSchema = z.object({
  id: z.string().min(1),
  tags: z.array(z.string()).optional(),
});
