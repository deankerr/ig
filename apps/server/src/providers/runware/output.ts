/**
 * Output resolution for Runware webhook payloads.
 *
 * Runware has a more standardized response format than fal.ai:
 * - Images: imageURL field with URL to the image
 * - Videos: videoURL field with URL to the video
 * - Cost is included in the response when includeCost=true
 */

export type ResolvedOutput =
  | { ok: true; data: ArrayBuffer | Uint8Array; contentType: string; cost?: number }
  | { ok: false; errorCode: string; errorMessage: string }

/**
 * Resolves outputs from a Runware webhook payload.
 * Returns an array of outputs - Runware can return multiple images per request.
 */
export async function resolveOutputs(payload: Record<string, unknown>): Promise<ResolvedOutput[]> {
  const outputs: ResolvedOutput[] = []

  // Check for imageURL (image inference)
  const imageURL = payload.imageURL as string | undefined
  if (imageURL) {
    const result = await fetchOutput(imageURL)
    if (result.ok) {
      outputs.push({
        ...result,
        cost: typeof payload.cost === "number" ? payload.cost : undefined,
      })
    } else {
      outputs.push(result)
    }
    return outputs
  }

  // Check for videoURL (video inference)
  const videoURL = payload.videoURL as string | undefined
  if (videoURL) {
    const result = await fetchOutput(videoURL)
    if (result.ok) {
      outputs.push({
        ...result,
        cost: typeof payload.cost === "number" ? payload.cost : undefined,
      })
    } else {
      outputs.push(result)
    }
    return outputs
  }

  // Check for imageDataURI (base64 data)
  const imageDataURI = payload.imageDataURI as string | undefined
  if (imageDataURI) {
    const result = parseDataURI(imageDataURI)
    if (result.ok) {
      outputs.push({
        ...result,
        cost: typeof payload.cost === "number" ? payload.cost : undefined,
      })
    } else {
      outputs.push(result)
    }
    return outputs
  }

  // Check for imageBase64Data
  const imageBase64Data = payload.imageBase64Data as string | undefined
  if (imageBase64Data) {
    // Assume PNG if no content type info available
    const contentType =
      (payload.outputFormat as string)?.toLowerCase() === "jpg"
        ? "image/jpeg"
        : (payload.outputFormat as string)?.toLowerCase() === "webp"
          ? "image/webp"
          : "image/png"

    try {
      const binaryString = atob(imageBase64Data)
      const bytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }
      outputs.push({
        ok: true,
        data: bytes,
        contentType,
        cost: typeof payload.cost === "number" ? payload.cost : undefined,
      })
      return outputs
    } catch {
      return [
        { ok: false, errorCode: "DECODE_FAILED", errorMessage: "Failed to decode base64 data" },
      ]
    }
  }

  return [
    {
      ok: false,
      errorCode: "UNKNOWN_OUTPUT",
      errorMessage: `Could not find output in Runware payload. Fields: ${Object.keys(payload).join(", ")}`,
    },
  ]
}

async function fetchOutput(
  url: string,
): Promise<
  | { ok: true; data: ArrayBuffer; contentType: string }
  | { ok: false; errorCode: string; errorMessage: string }
> {
  try {
    const response = await fetch(url)
    if (!response.ok) {
      return {
        ok: false,
        errorCode: "FETCH_FAILED",
        errorMessage: `Failed to fetch file: ${response.status}`,
      }
    }

    const contentType = response.headers.get("content-type") ?? "application/octet-stream"
    const data = await response.arrayBuffer()

    return { ok: true, data, contentType }
  } catch (error) {
    return {
      ok: false,
      errorCode: "FETCH_FAILED",
      errorMessage: `Failed to fetch file: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
}

function parseDataURI(
  dataURI: string,
):
  | { ok: true; data: Uint8Array; contentType: string }
  | { ok: false; errorCode: string; errorMessage: string } {
  try {
    // Format: data:image/png;base64,iVBORw0KGgo...
    const match = dataURI.match(/^data:([^;]+);base64,(.+)$/)
    if (!match) {
      return { ok: false, errorCode: "INVALID_DATA_URI", errorMessage: "Invalid data URI format" }
    }

    const contentType = match[1] ?? "application/octet-stream"
    const base64Data = match[2] ?? ""

    const binaryString = atob(base64Data)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }

    return { ok: true, data: bytes, contentType }
  } catch {
    return { ok: false, errorCode: "DECODE_FAILED", errorMessage: "Failed to decode data URI" }
  }
}
