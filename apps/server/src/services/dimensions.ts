// Resolve output dimensions for inference requests.
// Consolidates scattered sizing logic into one composable entry point.

import { imageDimensionsFromStream } from 'image-dimensions'
import { z } from 'zod'

import type { Context } from '../context'
import { getErrorMessage } from '../utils/error'
import type { Result } from '../utils/result'
import { zDomainUrl } from '../utils/validators'
import { resolveAutoAspectRatio } from './auto-aspect-ratio'

// -- Schema --

const presets = z.enum(['auto', 'landscape', 'portrait', 'square'])

const dimensionsObject = z.object({
  from: zDomainUrl,
  scale: z.number().positive().optional(),
  maxWidth: z.number().int().positive().optional(),
  maxHeight: z.number().int().positive().optional(),
})

export const dimensionsConfig = z.union([presets, dimensionsObject]).optional()
export type DimensionsConfig = z.infer<typeof dimensionsConfig>

// -- Preset dimensions --

const presetDimensions = {
  landscape: { width: 1536, height: 1024 },
  portrait: { width: 1024, height: 1536 },
  square: { width: 1280, height: 1280 },
} as const

// -- Types --

export type Dimensions = { width: number; height: number }

type ResolveDimensionsArgs = {
  config: DimensionsConfig
  prompt: string
}

// -- Main entry point --

async function resolveDimensions(
  ctx: Context,
  args: ResolveDimensionsArgs,
): Promise<Result<Dimensions>> {
  const { config, prompt } = args

  // No config or 'auto' → LLM classification
  if (config === undefined || config === 'auto') {
    return resolveFromPrompt(ctx, prompt)
  }

  // String preset → direct lookup
  if (typeof config === 'string') {
    return { ok: true, value: presetDimensions[config] }
  }

  // Object with `from` URL → fetch image dimensions
  const fetched = await fetchImageDimensions(config.from)
  if (!fetched.ok) return fetched

  const normalized = normalizeDimensions({
    ...fetched.value,
    scale: config.scale,
    maxWidth: config.maxWidth,
    maxHeight: config.maxHeight,
  })

  return { ok: true, value: normalized }
}

// -- Prompt-based resolution (delegates to auto-aspect-ratio) --

async function resolveFromPrompt(ctx: Context, prompt: string): Promise<Result<Dimensions>> {
  const ar = await resolveAutoAspectRatio(ctx, { prompt })
  if (!ar.ok) return { ok: false, message: ar.message }

  const dims = presetDimensions[ar.value.aspectRatio]
  return { ok: true, value: { ...dims } }
}

// -- Normalize dimensions: scale, clamp, round to 64 --

const MIN_DIM = 512
const MAX_DIM = 2048
const STEP = 64

type NormalizeArgs = {
  width: number
  height: number
  scale?: number
  maxWidth?: number
  maxHeight?: number
}

function normalizeDimensions(args: NormalizeArgs): Dimensions {
  let { width, height } = args

  // Apply uniform scale
  if (args.scale) {
    width = width * args.scale
    height = height * args.scale
  }

  // Clamp to bounds
  const maxW = args.maxWidth ?? MAX_DIM
  const maxH = args.maxHeight ?? MAX_DIM
  width = Math.max(MIN_DIM, Math.min(width, maxW))
  height = Math.max(MIN_DIM, Math.min(height, maxH))

  // Round to nearest multiple of 64
  width = Math.round(width / STEP) * STEP
  height = Math.round(height / STEP) * STEP

  return { width, height }
}

// -- Fetch image dimensions from URL via prefix fetch --

const FETCH_TIMEOUT_MS = 10_000
const PREFIX_BYTES = 65_536

async function fetchImageDimensions(url: string): Promise<Result<Dimensions>> {
  try {
    const response = await fetch(url, {
      headers: { Range: `bytes=0-${PREFIX_BYTES - 1}` },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })

    if (!response.ok && response.status !== 206) {
      return { ok: false, message: `Fetch failed: ${response.status} ${response.statusText}` }
    }

    if (!response.body) {
      return { ok: false, message: 'Response has no body' }
    }

    const dims = await imageDimensionsFromStream(response.body)
    if (!dims) {
      return { ok: false, message: 'Could not detect image dimensions' }
    }

    return { ok: true, value: { width: dims.width, height: dims.height } }
  } catch (error) {
    return { ok: false, message: getErrorMessage(error) }
  }
}

export const dimensionsService = { resolve: resolveDimensions }
