// Model profile types for provider-specific constraints.

export type ReferenceImageConfig = {
  path: 'seedImage' | 'referenceImages' | 'inputs.referenceImages'
  maxItems?: number
}

export type ModelProfile = {
  match: { air?: string[]; architecture?: string[] }
  sizes: Record<string, [number, number][]>
  range?: { min: number; max: number; divisor: number }
  referenceImages?: ReferenceImageConfig
}
