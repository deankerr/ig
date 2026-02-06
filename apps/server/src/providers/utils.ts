/**
 * Shared utilities for provider implementations.
 */

import type { Result } from "../utils/result"
import { getErrorMessage } from "../utils/error"

type FetchResult = Result<{ data: ArrayBuffer; contentType: string | null }>

/**
 * Fetch data from a URL with error handling.
 */
export async function fetchUrl(url: string): Promise<FetchResult> {
  try {
    const response = await fetch(url)
    if (!response.ok) {
      return { ok: false, message: `HTTP ${response.status}` }
    }
    const contentType = response.headers.get("content-type")
    return { ok: true, value: { data: await response.arrayBuffer(), contentType } }
  } catch (err) {
    return { ok: false, message: getErrorMessage(err) }
  }
}

/**
 * Decode a base64 string to Uint8Array.
 */
export function decodeBase64(base64: string): Uint8Array | null {
  try {
    const binaryString = atob(base64)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }
    return bytes
  } catch {
    return null
  }
}

/**
 * Parse a data URI and decode its contents.
 * Format: data:image/png;base64,iVBORw0KGgo...
 */
export function parseDataURI(dataURI: string): { data: Uint8Array; contentType: string } | null {
  const match = dataURI.match(/^data:([^;]+);base64,(.+)$/)
  if (!match) return null

  const contentType = match[1] ?? "application/octet-stream"
  const base64Data = match[2] ?? ""

  const data = decodeBase64(base64Data)
  if (!data) return null

  return { data, contentType }
}
