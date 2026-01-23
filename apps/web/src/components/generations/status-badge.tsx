import { Circle } from "lucide-react"

import { cn } from "@/lib/utils"

type GenerationStatus = "pending" | "ready" | "failed"

const statusConfig = {
  pending: {
    label: "pending",
    colorClass: "text-status-pending",
  },
  ready: {
    label: "ready",
    colorClass: "text-status-ready",
  },
  failed: {
    label: "failed",
    colorClass: "text-status-failed",
  },
} as const

export function StatusBadge({
  status,
  showLabel = true,
}: {
  status: GenerationStatus
  showLabel?: boolean
}) {
  const config = statusConfig[status]

  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs", config.colorClass)}>
      <Circle className={cn("h-2 w-2 fill-current", status === "pending" && "animate-pulse")} />
      {showLabel && <span>{config.label}</span>}
    </span>
  )
}
