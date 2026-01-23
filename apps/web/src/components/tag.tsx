import { X } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * Tag component with text wrapping support for long tags.
 */
export function Tag({
  children,
  onRemove,
  className,
}: {
  children: React.ReactNode
  onRemove?: () => void
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-1.5 py-0.5 text-xs bg-secondary text-secondary-foreground break-all",
        className,
      )}
    >
      <span className="break-all">{children}</span>
      {onRemove && (
        <button onClick={onRemove} className="shrink-0 hover:text-destructive transition-colors">
          <X className="h-3 w-3" />
        </button>
      )}
    </span>
  )
}
