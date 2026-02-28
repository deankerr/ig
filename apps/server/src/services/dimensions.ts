// Resolve output dimensions for inference requests.
// Single owner of sizing — callers always go through this service.
// Never fails — always returns dimensions. Sub-process results preserved in annotations.

import { db } from '@ig/db'
import { artifacts, tags } from '@ig/db/schema'
import { and, eq } from 'drizzle-orm'
import { imageDimensionsFromStream } from 'image-dimensions'
import { z } from 'zod'

import type { Context } from '../context'
import type { ImageInferenceInput } from '../inference/schema'
import { type DimensionProfile, profiles } from '../profiles'
import { getErrorMessage, serializeError } from '../utils/error'
import type { Result } from '../utils/result'
import { zDomainUrl } from '../utils/validators'
import { type AutoAspectRatioResult, resolveAutoAspectRatio } from './auto-aspect-ratio'
import { lookupModel } from './models'
import { TAG_KEYS } from './tags'

// -- Schema --

const presets = z.enum(['default', 'auto', 'landscape', 'portrait', 'square'])

const dimensionsObject = z.object({
  from: zDomainUrl,
  scale: z.number().positive().optional(),
  maxWidth: z.number().int().positive().optional(),
  maxHeight: z.number().int().positive().optional(),
})

export const dimensionsConfig = z.union([presets, dimensionsObject]).default('default')
export type DimensionsConfig = z.infer<typeof dimensionsConfig>

// -- Types --

export type Dimensions = { width: number; height: number }

type ImageFetchData = Dimensions & { url: string }
type ImageFetchResult = Result<ImageFetchData, { url: string; cause: Record<string, unknown> }>

export type DimensionsResult = Dimensions & {
  annotations: {
    autoAspectRatio?: AutoAspectRatioResult
    imageFetch?: ImageFetchResult
    profile?: { match: DimensionProfile['match'] }
  }
}

type ResolveDimensionsArgs = {
  input: ImageInferenceInput
  config: DimensionsConfig
}

// -- Main entry point --

async function resolveDimensions(
  ctx: Context,
  args: ResolveDimensionsArgs,
): Promise<DimensionsResult> {
  const { input, config } = args

  // -- String presets --
  if (typeof config === 'string') {
    // Explicit dimensions or default → 1024x1024 fallback
    if (config === 'default') {
      return { width: input.width ?? 1024, height: input.height ?? 1024, annotations: {} }
    }

    // Resolve orientation (auto → LLM, otherwise direct)
    let orientation: string
    let autoAspectRatio: AutoAspectRatioResult | undefined

    if (config === 'auto') {
      const ar = await resolveAutoAspectRatio(ctx, { prompt: input.positivePrompt })
      autoAspectRatio = ar
      orientation = ar.ok ? ar.value.aspectRatio : 'square'
    } else {
      orientation = config
    }

    // Resolve orientation → model-specific dimensions via profile
    const modelData = await lookupModel(ctx, input.model)
    const profile = profiles.findProfile({
      air: input.model,
      architecture: modelData?.architecture,
    })
    return {
      ...profiles.getDefaultSize(profile, orientation),
      annotations: { autoAspectRatio, profile: { match: profile.match } },
    }
  }

  // -- Object config: derive dimensions from source image --

  const modelData = await lookupModel(ctx, input.model)
  const profile = profiles.findProfile({ air: input.model, architecture: modelData?.architecture })
  const profileAnnotation = { match: profile.match }

  // Try local DB lookup first (our own artifacts), fall back to HTTP fetch
  const imageFetch =
    (await lookupLocalDimensions(ctx.env.PUBLIC_URL, config.from)) ??
    (await fetchImageDimensions(config.from))
  if (!imageFetch.ok) {
    // Image fetch failed → fall back to profile's square size
    return {
      ...profiles.getDefaultSize(profile, 'square'),
      annotations: { imageFetch, profile: profileAnnotation },
    }
  }

  let { width, height } = imageFetch.value

  // Apply user scale
  if (config.scale) {
    width *= config.scale
    height *= config.scale
  }

  // Apply user max constraints (scale down proportionally)
  if (config.maxWidth && width > config.maxWidth) {
    height *= config.maxWidth / width
    width = config.maxWidth
  }
  if (config.maxHeight && height > config.maxHeight) {
    width *= config.maxHeight / height
    height = config.maxHeight
  }

  // Fit to model's profile constraints
  return {
    ...fitToProfile(profile, width, height),
    annotations: { imageFetch, profile: profileAnnotation },
  }
}

// -- Fit arbitrary dimensions to a profile's constraints --

function fitToProfile(profile: DimensionProfile, width: number, height: number): Dimensions {
  // Fixed-size profiles → snap to closest size by aspect ratio
  if (!profile.range) return snapToClosestSize(profile, width, height)

  // Range profiles → snap to divisor, then scale into bounds
  return fitToRange(profile.range, width, height)
}

// Find the profile size whose aspect ratio most closely matches the input
function snapToClosestSize(profile: DimensionProfile, width: number, height: number): Dimensions {
  const targetRatio = width / height
  let best: [number, number] | undefined
  let bestDiff = Infinity

  for (const sizes of Object.values(profile.sizes)) {
    for (const size of sizes) {
      const diff = Math.abs(size[0] / size[1] - targetRatio)
      if (diff < bestDiff) {
        bestDiff = diff
        best = size
      }
    }
  }

  if (best) return { width: best[0], height: best[1] }
  return { width: 1024, height: 1024 }
}

// Snap to divisor and scale to fit within [min, max]
function fitToRange(
  range: { min: number; max: number; divisor: number },
  width: number,
  height: number,
): Dimensions {
  const { min, max, divisor } = range

  let w = roundTo(width, divisor)
  let h = roundTo(height, divisor)

  // Scale up if either dim is below min (ceil to stay >= min)
  if (w < min || h < min) {
    const scale = Math.max(min / w, min / h)
    w = ceilTo(w * scale, divisor)
    h = ceilTo(h * scale, divisor)
  }

  // Scale down if either dim is above max (floor to stay <= max)
  if (w > max || h > max) {
    const scale = Math.min(max / w, max / h)
    w = floorTo(w * scale, divisor)
    h = floorTo(h * scale, divisor)
  }

  return { width: w, height: h }
}

const roundTo = (n: number, step: number) => Math.round(n / step) * step
const ceilTo = (n: number, step: number) => Math.ceil(n / step) * step
const floorTo = (n: number, step: number) => Math.floor(n / step) * step

// -- Look up dimensions from DB for our own hosted artifacts --

async function lookupLocalDimensions(
  publicUrl: string,
  url: string,
): Promise<ImageFetchResult | null> {
  if (!url.startsWith(publicUrl)) return null

  const path = url.slice(publicUrl.length)

  // /artifacts/{id}/file → direct ID lookup
  const directMatch = path.match(/^\/artifacts\/([^/]+)\/file/)
  if (directMatch) {
    const id = directMatch[1]!
    const [row] = await db
      .select({ width: artifacts.width, height: artifacts.height })
      .from(artifacts)
      .where(eq(artifacts.id, id))
      .limit(1)
    if (!row || row.width == null || row.height == null) return null
    return { ok: true, value: { width: row.width, height: row.height, url } }
  }

  // /a/{slug} → slug tag lookup → artifact ID → dimensions
  const slugMatch = path.match(/^\/a\/([^/.]+)/)
  if (slugMatch) {
    const slug = slugMatch[1]!
    const [tagRow] = await db
      .select({ targetId: tags.targetId })
      .from(tags)
      .where(and(eq(tags.tag, TAG_KEYS.slug), eq(tags.value, slug)))
      .limit(1)
    if (!tagRow) return null

    const [row] = await db
      .select({ width: artifacts.width, height: artifacts.height })
      .from(artifacts)
      .where(eq(artifacts.id, tagRow.targetId))
      .limit(1)
    if (!row || row.width == null || row.height == null) return null
    return { ok: true, value: { width: row.width, height: row.height, url } }
  }

  return null
}

// -- Fetch image dimensions from URL via prefix fetch --

const FETCH_TIMEOUT_MS = 10_000
const PREFIX_BYTES = 65_536

async function fetchImageDimensions(url: string): Promise<ImageFetchResult> {
  try {
    const response = await fetch(url, {
      headers: { Range: `bytes=0-${PREFIX_BYTES - 1}` },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })

    if (!response.ok && response.status !== 206) {
      return {
        ok: false,
        message: `Fetch failed: ${response.status} ${response.statusText}`,
        error: { url, cause: { status: response.status, statusText: response.statusText } },
      }
    }

    if (!response.body) {
      return {
        ok: false,
        message: 'Response has no body',
        error: { url, cause: { status: response.status } },
      }
    }

    const dims = await imageDimensionsFromStream(response.body)
    if (!dims) {
      return {
        ok: false,
        message: 'Could not detect image dimensions',
        error: { url, cause: {} },
      }
    }

    return { ok: true, value: { width: dims.width, height: dims.height, url } }
  } catch (error) {
    return {
      ok: false,
      message: getErrorMessage(error),
      error: { url, cause: serializeError(error) },
    }
  }
}

export const dimensionsService = { resolve: resolveDimensions }
