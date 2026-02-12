/** Format a unit price with dynamic decimal precision (minimum 2). */
export function formatPrice(unitPrice: number | null, unit?: string | null): string {
  if (unitPrice == null) return '\u2014'
  const decimals = Math.max(2, unitPrice.toString().split('.')[1]?.length ?? 0)
  const price = `$${unitPrice.toFixed(decimals)}`
  return unit ? `${price}/${unit}` : price
}

/** Extract a display string from an inference input object. */
export function formatPrompt(input: Record<string, unknown>): string {
  const value = input.positivePrompt ?? input.prompt
  return typeof value === 'string' ? value : ''
}

/** Format millisecond duration as compact human-readable string. */
export function formatDuration(ms: number) {
  if (ms < 1000) return `${Math.round(ms)}ms`
  const s = ms / 1000
  if (s < 60) return `${s.toFixed(1)}s`
  const m = Math.floor(s / 60)
  const remainder = Math.round(s % 60)
  return `${m}m ${remainder}s`
}
