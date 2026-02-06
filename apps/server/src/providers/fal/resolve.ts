/**
 * fal.ai webhook resolution.
 * Verifies signature, parses payload, fetches URLs, returns resolved outputs.
 */

import type { WebHookResponse } from "@fal-ai/client"

import type { ProviderResult, ResolvedOutput } from "../types"
import { fetchUrl } from "../utils"
import { verifyWebhook } from "./verify"

/**
 * Metadata fields to extract from fal payloads.
 */
const METADATA_FIELDS = ["timings", "has_nsfw_concepts", "seed", "prompt"]

/**
 * Fields that may contain file outputs.
 */
const FILE_FIELDS = ["image", "images", "video", "audio", "audio_url"]

/**
 * Fields that may contain text outputs.
 */
const TEXT_FIELDS = ["output", "text"]

/**
 * Resolve a fal.ai webhook into ready-to-store outputs.
 */
export async function resolveFalWebhook(
  rawBody: ArrayBuffer,
  headers: Headers,
): Promise<ProviderResult> {
  // Verify signature
  const verification = await verifyWebhook(headers, rawBody)
  if (!verification.valid) {
    return { ok: false, message: verification.error, error: { code: "SIGNATURE_INVALID" } }
  }

  // Parse JSON
  let body: WebHookResponse
  try {
    body = JSON.parse(new TextDecoder().decode(rawBody)) as WebHookResponse
  } catch {
    return { ok: false, message: "Failed to parse webhook body", error: { code: "INVALID_JSON" } }
  }
  console.log("fal_webhook", body)

  const payload = (body.payload ?? {}) as Record<string, unknown>

  // Check for fal errors
  if (body.status === "ERROR") {
    return { ok: false, message: body.error ?? "Unknown error", error: { code: "FAL_ERROR" } }
  }

  // Extract metadata
  const metadata: Record<string, unknown> = {}
  for (const field of METADATA_FIELDS) {
    if (field in payload) {
      metadata[field] = payload[field]
    }
  }

  // Find and resolve outputs
  const outputs = await resolveOutputs(payload)

  if (outputs.length === 0) {
    return {
      ok: false,
      message: `No outputs found in payload. Fields: ${Object.keys(payload).join(", ")}`,
      error: { code: "NO_OUTPUTS" },
    }
  }

  return {
    ok: true,
    value: { outputs, requestId: body.request_id, metadata },
  }
}

/**
 * Extract and resolve outputs from a fal payload.
 */
async function resolveOutputs(payload: Record<string, unknown>): Promise<ResolvedOutput[]> {
  // Try file fields first
  for (const field of FILE_FIELDS) {
    const value = payload[field]

    // Handle arrays of files
    if (Array.isArray(value)) {
      const outputs: ResolvedOutput[] = []
      for (const item of value) {
        if (item && typeof item === "object" && "url" in item) {
          const { url, content_type } = item as { url: string; content_type?: string }
          outputs.push(await resolveUrl(url, content_type))
        }
      }
      if (outputs.length > 0) return outputs
    }

    // Handle single file object
    if (value && typeof value === "object" && "url" in value) {
      const { url, content_type } = value as { url: string; content_type?: string }
      return [await resolveUrl(url, content_type)]
    }
  }

  // Try text fields
  for (const field of TEXT_FIELDS) {
    const value = payload[field]
    if (typeof value === "string") {
      return [
        {
          ok: true,
          value: {
            data: new TextEncoder().encode(value),
            contentType: "text/plain; charset=utf-8",
          },
        },
      ]
    }
  }

  return []
}

/**
 * Fetch a URL and return a resolved output.
 */
async function resolveUrl(url: string, hintContentType?: string): Promise<ResolvedOutput> {
  const result = await fetchUrl(url)
  if (!result.ok) {
    return { ok: false, message: result.message, error: { code: "FETCH_FAILED" } }
  }
  return {
    ok: true,
    value: {
      data: result.value.data,
      contentType: result.value.contentType ?? hintContentType ?? "application/octet-stream",
    },
  }
}
