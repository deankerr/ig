/**
 * Output resolution for fal.ai webhook payloads.
 * Detects and fetches files/text from various output formats.
 */

export type ResolvedOutput =
  | { ok: true; data: ArrayBuffer | Uint8Array; contentType: string }
  | { ok: false; errorCode: string; errorMessage: string }

/**
 * Resolves ALL outputs from a fal.ai webhook payload.
 * Returns an array of outputs - one for single output, multiple for batch outputs.
 */
export async function resolveOutputs(payload: Record<string, unknown>): Promise<ResolvedOutput[]> {
  const outputs: ResolvedOutput[] = []

  // Try to find file URLs - check common field names
  const fileFields = ["images", "image", "video", "audio", "audio_url"]

  for (const field of fileFields) {
    const value = payload[field]

    // Handle arrays of files
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item && typeof item === "object" && "url" in item) {
          const { url, content_type } = item as { url: string; content_type?: string }

          const response = await fetch(url)
          if (!response.ok) {
            outputs.push({
              ok: false,
              errorCode: "FETCH_FAILED",
              errorMessage: `Failed to fetch file: ${response.status}`,
            })
            continue
          }

          outputs.push({
            ok: true,
            data: await response.arrayBuffer(),
            contentType: content_type ?? "application/octet-stream",
          })
        }
      }
      if (outputs.length > 0) return outputs
    }

    // Handle single file object
    if (value && typeof value === "object" && "url" in value) {
      const { url, content_type } = value as { url: string; content_type?: string }

      const response = await fetch(url)
      if (!response.ok) {
        return [
          {
            ok: false,
            errorCode: "FETCH_FAILED",
            errorMessage: `Failed to fetch file: ${response.status}`,
          },
        ]
      }

      return [
        {
          ok: true,
          data: await response.arrayBuffer(),
          contentType: content_type ?? "application/octet-stream",
        },
      ]
    }
  }

  // Try to find text output
  const textFields = ["output", "text"]

  for (const field of textFields) {
    const value = payload[field]
    if (typeof value === "string") {
      return [
        {
          ok: true,
          data: new TextEncoder().encode(value),
          contentType: "text/plain; charset=utf-8",
        },
      ]
    }
  }

  return [
    {
      ok: false,
      errorCode: "UNKNOWN_OUTPUT",
      errorMessage: `Could not find output in payload. Fields: ${Object.keys(payload).join(", ")}`,
    },
  ]
}
