/**
 * Runware webhook resolution.
 * Parses payload, decodes base64/dataURI, fetches URLs if needed, returns resolved outputs.
 */

import type { ProviderResult, ResolvedOutput } from "../types"
import { decodeBase64, fetchUrl, parseDataURI } from "../utils"
import { RunwareWebhookSchema, RunwareDataSchema } from "./schemas"
import type { z } from "zod"

type RunwareData = z.infer<typeof RunwareDataSchema>

/**
 * Resolve a Runware webhook into ready-to-store outputs.
 * Runware wraps results in a `data` array, with one item per generated image.
 */
export async function resolveRunwareWebhook(rawPayload: unknown): Promise<ProviderResult> {
  const parsed = RunwareWebhookSchema.safeParse(rawPayload)
  if (!parsed.success) {
    return {
      ok: false,
      code: "INVALID_PAYLOAD",
      message: parsed.error.message,
    }
  }

  if ("error" in parsed.data) {
    const error = parsed.data.error as { message: string }
    return {
      ok: false,
      code: "RUNWARE_ERROR",
      message: error.message,
    }
  }

  const { data } = parsed.data

  const resolved = await Promise.all(data.map(resolveOutput))
  const outputs = resolved.filter((o): o is ResolvedOutput => o !== null)

  if (outputs.length === 0) {
    return {
      ok: false,
      code: "NO_OUTPUTS",
      message: `No outputs resolved from ${data.length} item(s)`,
    }
  }

  return {
    ok: true,
    outputs,
    requestId: data[0]?.taskUUID as string | undefined,
  }
}

/**
 * Resolve a single output from a Runware data item.
 * Checks URL fields first (preferred), then data URIs, then raw base64.
 */
async function resolveOutput(item: RunwareData): Promise<ResolvedOutput | null> {
  // URLs - fetch and use response content type
  if (item.imageURL) {
    const result = await fetchUrl(item.imageURL)
    if (!result.ok) {
      return { ok: false, code: "FETCH_FAILED", message: result.error }
    }
    return {
      ok: true,
      data: result.data,
      contentType: result.contentType ?? "application/octet-stream",
      metadata: item,
    }
  }

  if (item.videoURL) {
    const result = await fetchUrl(item.videoURL)
    if (!result.ok) {
      return { ok: false, code: "FETCH_FAILED", message: result.error }
    }
    return {
      ok: true,
      data: result.data,
      contentType: result.contentType ?? "application/octet-stream",
      metadata: item,
    }
  }

  if (item.audioURL) {
    const result = await fetchUrl(item.audioURL)
    if (!result.ok) {
      return { ok: false, code: "FETCH_FAILED", message: result.error }
    }
    return {
      ok: true,
      data: result.data,
      contentType: result.contentType ?? "application/octet-stream",
      metadata: item,
    }
  }

  // Data URIs - content type embedded in URI
  if (item.imageDataURI) {
    const parsed = parseDataURI(item.imageDataURI)
    if (!parsed) {
      return { ok: false, code: "DECODE_FAILED", message: "Failed to decode image data URI" }
    }
    item.imageDataURI = "[extracted]"
    return {
      ok: true,
      data: parsed.data,
      contentType: parsed.contentType,
      metadata: item,
    }
  }

  if (item.audioDataURI) {
    const parsed = parseDataURI(item.audioDataURI)
    if (!parsed) {
      return { ok: false, code: "DECODE_FAILED", message: "Failed to decode audio data URI" }
    }
    item.audioDataURI = "[extracted]"
    return {
      ok: true,
      data: parsed.data,
      contentType: parsed.contentType,
      metadata: item,
    }
  }

  // Raw base64 - no content type info, must infer
  // TODO: detect content type from magic bytes if not inferable
  if (item.imageBase64Data) {
    const decoded = decodeBase64(item.imageBase64Data)
    if (!decoded) {
      return { ok: false, code: "DECODE_FAILED", message: "Failed to decode image base64" }
    }
    item.imageBase64Data = "[extracted]"
    return {
      ok: true,
      data: decoded,
      contentType: "image/png", // default, URL/dataURI preferred
      metadata: item,
    }
  }

  if (item.audioBase64Data) {
    const decoded = decodeBase64(item.audioBase64Data)
    if (!decoded) {
      return { ok: false, code: "DECODE_FAILED", message: "Failed to decode audio base64" }
    }
    item.audioBase64Data = "[extracted]"
    return {
      ok: true,
      data: decoded,
      contentType: "audio/mpeg", // default, URL/dataURI preferred
      metadata: item,
    }
  }

  return null
}
