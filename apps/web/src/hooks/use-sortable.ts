import { useState, useMemo } from 'react'

type SortDirection = 'asc' | 'desc'
type SortConfig<T> = { key: keyof T; direction: SortDirection }

export function useSortable<T>(items: T[], defaultSort?: SortConfig<T>) {
  const [sortConfig, setSortConfig] = useState<SortConfig<T> | null>(defaultSort ?? null)

  const sortedItems = useMemo(() => {
    if (!sortConfig) return items

    return [...items].sort((a, b) => {
      const aVal = a[sortConfig.key]
      const bVal = b[sortConfig.key]

      // Nulls sort to end
      if (aVal == null && bVal == null) return 0
      if (aVal == null) return 1
      if (bVal == null) return -1

      const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0
      return sortConfig.direction === 'asc' ? comparison : -comparison
    })
  }, [items, sortConfig])

  const toggleSort = (key: keyof T) => {
    setSortConfig((current) => {
      if (current?.key !== key) return { key, direction: 'asc' }
      if (current.direction === 'asc') return { key, direction: 'desc' }
      return null // Remove sort on third click
    })
  }

  return { sortedItems, sortConfig, toggleSort }
}
