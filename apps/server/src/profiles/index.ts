// Model profiles — dimension constraints per provider/architecture.
// Run directly: bun apps/server/src/profiles/index.ts

import { bytedance } from './bytedance'
import { flux } from './flux'
import { google } from './google'
import { midjourney } from './midjourney'
import { openai } from './openai'
import { other } from './other'
import { sd } from './sd'
import type { DimensionProfile } from './types'
import { xai } from './xai'

export type { DimensionProfile } from './types'

// Catch-all for unknown models — used directly as fallback, not in the match list
const defaultProfile: DimensionProfile = {
  match: {},
  range: { min: 512, max: 2048, divisor: 16 },
  sizes: {
    landscape: [[1344, 896]],
    portrait: [[896, 1344]],
    square: [[1024, 1024]],
    '1:1': [[1024, 1024]],
    '4:3': [[1280, 960]],
    '3:4': [[960, 1280]],
    '3:2': [[1344, 896]],
    '2:3': [[896, 1344]],
    '16:9': [[1408, 768]],
    '9:16': [[768, 1408]],
  },
}

// Ordered list — first match wins
const allProfiles: DimensionProfile[] = [
  ...openai,
  ...flux,
  ...midjourney,
  ...google,
  ...xai,
  ...bytedance,
  ...sd,
  ...other,
]

// -- API --

type MatchArgs = {
  air?: string
  architecture?: string
}

function findProfile(args: MatchArgs): DimensionProfile {
  for (const profile of allProfiles) {
    const m = profile.match

    // AIR exact match (checked first)
    if (m.air && args.air && m.air.includes(args.air)) return profile

    // Architecture exact match
    if (m.architecture && args.architecture && m.architecture.includes(args.architecture))
      return profile
  }

  return defaultProfile
}

function getDefaultSize(
  profile: DimensionProfile,
  ratio: string,
): { width: number; height: number } {
  const sizes = profile.sizes[ratio]
  const first = sizes?.[0]
  if (!first) {
    // Fall back to default profile for missing keys
    const fallback = defaultProfile.sizes[ratio]?.[0]
    if (fallback) return { width: fallback[0], height: fallback[1] }
    return { width: 1024, height: 1024 }
  }
  return { width: first[0], height: first[1] }
}

export const profiles = { findProfile, getDefaultSize }

// -- Demo --

if (import.meta.main) {
  const cases: MatchArgs[] = [
    { architecture: 'midjourney_v7' },
    { air: 'openai:2@3' },
    { architecture: 'gemini_3_0_pro_image' },
    { architecture: 'sdxl' },
    { architecture: 'flux_2_pro' },
    { architecture: 'some_unknown_model' },
  ]

  for (const args of cases) {
    const label = args.air ?? args.architecture
    const profile = profiles.findProfile(args)
    console.log(`\n${label}:`)
    for (const key of ['landscape', 'portrait', 'square'] as const) {
      console.log(`  ${key}:`, profiles.getDefaultSize(profile, key))
    }
  }
}
