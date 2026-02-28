// Dimension profile types for model-specific size constraints.

export type DimensionProfile = {
  match: { air?: string[]; architecture?: string[] }
  sizes: Record<string, [number, number][]>
  range?: { min: number; max: number; divisor: number }
}
