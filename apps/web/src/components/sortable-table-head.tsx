import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react"
import { TableHead } from "@/components/ui/table"
import { cn } from "@/lib/utils"

type SortDirection = "asc" | "desc"

type Props<T extends string> = {
  children: React.ReactNode
  sortKey: T
  currentSort: { key: T; direction: SortDirection } | null
  onSort: (key: T) => void
  className?: string
}

export function SortableTableHead<T extends string>({
  children,
  sortKey,
  currentSort,
  onSort,
  className,
}: Props<T>) {
  const isActive = currentSort?.key === sortKey
  const Icon = !isActive ? ArrowUpDown : currentSort.direction === "asc" ? ArrowUp : ArrowDown

  return (
    <TableHead
      className={cn("cursor-pointer select-none hover:bg-muted/50 transition-colors", className)}
      onClick={() => onSort(sortKey)}
    >
      <span className="flex items-center gap-1">
        {children}
        <Icon className={cn("h-3 w-3", isActive ? "opacity-100" : "opacity-40")} />
      </span>
    </TableHead>
  )
}
