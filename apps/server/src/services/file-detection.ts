// Detect content type and image dimensions from raw file bytes.

import { fileTypeFromBuffer } from 'file-type'
import { imageDimensionsFromData } from 'image-dimensions'

export type FileDetection = {
  contentType: string
  width?: number
  height?: number
}

/** Detect content type via magic bytes and extract image dimensions if applicable. */
export async function detectFile(
  data: ArrayBuffer | Uint8Array,
  contentTypeHint = 'application/octet-stream',
): Promise<FileDetection> {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data)

  const detected = await fileTypeFromBuffer(bytes)
  const contentType = detected?.mime ?? contentTypeHint

  // Dimensions only apply to images — returns undefined for non-images
  const dims = imageDimensionsFromData(bytes)

  return {
    contentType,
    width: dims?.width,
    height: dims?.height,
  }
}
