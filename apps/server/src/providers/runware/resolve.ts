/**
 * Runware webhook resolution.
 * Parses payload, decodes base64/dataURI, fetches URLs if needed, returns resolved outputs.
 */

import type { z } from 'zod'

import type { ProviderResult, ResolvedOutput } from '../types'
import { decodeBase64, fetchUrl, parseDataURI } from '../utils'
import { RunwareWebhookSchema, RunwareDataSchema } from './schemas'

type RunwareData = z.infer<typeof RunwareDataSchema>

/**
 * Resolve a Runware webhook into ready-to-store outputs.
 * Runware wraps results in a `data` array, with one item per generated image.
 */
export async function resolveRunwareWebhook(rawPayload: unknown): Promise<ProviderResult> {
  const parsed = RunwareWebhookSchema.safeParse(rawPayload)
  if (!parsed.success) {
    return { ok: false, message: parsed.error.message, error: { code: 'INVALID_PAYLOAD' } }
  }

  if ('error' in parsed.data) {
    const err = parsed.data.error as { message: string }
    return { ok: false, message: err.message, error: { code: 'RUNWARE_ERROR' } }
  }

  const { data } = parsed.data

  const resolved = await Promise.all(data.map(resolveOutput))
  const outputs = resolved.filter((o): o is ResolvedOutput => o !== null)

  if (outputs.length === 0) {
    return {
      ok: false,
      message: `No outputs resolved from ${data.length} item(s)`,
      error: { code: 'NO_OUTPUTS' },
    }
  }

  return {
    ok: true,
    value: { outputs, requestId: data[0]?.taskUUID as string | undefined },
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
      return { ok: false, message: result.message, error: { code: 'FETCH_FAILED' } }
    }
    return {
      ok: true,
      value: {
        data: result.value.data,
        contentType: result.value.contentType ?? 'application/octet-stream',
        metadata: item,
      },
    }
  }

  if (item.videoURL) {
    const result = await fetchUrl(item.videoURL)
    if (!result.ok) {
      return { ok: false, message: result.message, error: { code: 'FETCH_FAILED' } }
    }
    return {
      ok: true,
      value: {
        data: result.value.data,
        contentType: result.value.contentType ?? 'application/octet-stream',
        metadata: item,
      },
    }
  }

  if (item.audioURL) {
    const result = await fetchUrl(item.audioURL)
    if (!result.ok) {
      return { ok: false, message: result.message, error: { code: 'FETCH_FAILED' } }
    }
    return {
      ok: true,
      value: {
        data: result.value.data,
        contentType: result.value.contentType ?? 'application/octet-stream',
        metadata: item,
      },
    }
  }

  // Data URIs - content type embedded in URI
  if (item.imageDataURI) {
    const parsed = parseDataURI(item.imageDataURI)
    if (!parsed) {
      return {
        ok: false,
        message: 'Failed to decode image data URI',
        error: { code: 'DECODE_FAILED' },
      }
    }
    item.imageDataURI = '[extracted]'
    return {
      ok: true,
      value: { data: parsed.data, contentType: parsed.contentType, metadata: item },
    }
  }

  if (item.audioDataURI) {
    const parsed = parseDataURI(item.audioDataURI)
    if (!parsed) {
      return {
        ok: false,
        message: 'Failed to decode audio data URI',
        error: { code: 'DECODE_FAILED' },
      }
    }
    item.audioDataURI = '[extracted]'
    return {
      ok: true,
      value: { data: parsed.data, contentType: parsed.contentType, metadata: item },
    }
  }

  // Raw base64 - no content type info, must infer
  // TODO: detect content type from magic bytes if not inferable
  if (item.imageBase64Data) {
    const decoded = decodeBase64(item.imageBase64Data)
    if (!decoded) {
      return {
        ok: false,
        message: 'Failed to decode image base64',
        error: { code: 'DECODE_FAILED' },
      }
    }
    item.imageBase64Data = '[extracted]'
    return {
      ok: true,
      value: { data: decoded, contentType: 'image/png', metadata: item },
    }
  }

  if (item.audioBase64Data) {
    const decoded = decodeBase64(item.audioBase64Data)
    if (!decoded) {
      return {
        ok: false,
        message: 'Failed to decode audio base64',
        error: { code: 'DECODE_FAILED' },
      }
    }
    item.audioBase64Data = '[extracted]'
    return {
      ok: true,
      value: { data: decoded, contentType: 'audio/mpeg', metadata: item },
    }
  }

  return null
}
