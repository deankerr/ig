// CDN fetch → R2 upload → artifact output result.

import { v7 as uuidv7 } from 'uuid'

import type { Context } from '../context'
import type { WebhookItem } from './request'
import { output, type Output } from './result'

/** Fetch image from CDN URL, upload to R2, return output result. */
export async function storeArtifact(
  ctx: Context,
  args: { item: WebhookItem; contentType: string; now: Date },
): Promise<Output> {
  const { item, contentType, now } = args

  // Fetch from CDN
  const response = await fetch(item.imageURL)
  if (!response.ok) {
    return output.fetchError(item.imageURL, response.status, await response.text(), item.raw, now)
  }

  // Upload to R2
  const id = uuidv7()
  const r2Key = `artifacts/${id}`

  try {
    await ctx.env.ARTIFACTS_BUCKET.put(r2Key, response.body, {
      httpMetadata: { contentType },
    })
  } catch (err) {
    return output.storageError(r2Key, err, item.raw, now)
  }

  return output.success({
    id,
    r2Key,
    contentType,
    seed: item.seed,
    cost: item.cost,
    createdAt: now,
  })
}
