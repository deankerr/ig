import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

type GenerationStatus = "pending" | "ready" | "failed"

const statusConfig = {
  pending: {
    label: "Pending",
    className: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
  },
  ready: {
    label: "Ready",
    className: "bg-green-500/10 text-green-600 dark:text-green-400",
  },
  failed: {
    label: "Failed",
    className: "bg-red-500/10 text-red-600 dark:text-red-400",
  },
} as const

export function StatusBadge({ status }: { status: GenerationStatus }) {
  const config = statusConfig[status]
  return (
    <Badge variant="outline" className={cn("border-transparent", config.className)}>
      {config.label}
    </Badge>
  )
}
