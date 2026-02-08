/** Format a unit price with dynamic decimal precision (minimum 2). */
export function formatPrice(unitPrice: number | null, unit?: string | null): string {
  if (unitPrice == null) return '\u2014'
  const decimals = Math.max(2, unitPrice.toString().split('.')[1]?.length ?? 0)
  const price = `$${unitPrice.toFixed(decimals)}`
  return unit ? `${price}/${unit}` : price
}

/** Elapsed seconds between two dates, formatted to 1 decimal place. */
export function formatDuration(start: Date | string, end: Date | string): string {
  const ms = new Date(end).getTime() - new Date(start).getTime()
  return (ms / 1000).toFixed(1)
}

/** Coerce a date-like value to a Date, or null if missing. */
export function parseDate(value: string | Date | null | undefined): Date | null {
  if (value == null) return null
  return value instanceof Date ? value : new Date(value)
}

/** Normalize slug input: lowercase, alphanumeric + dash + slash only. */
export function normalizeSlug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9-/]/g, '')
}
