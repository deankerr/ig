import { XIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

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
        'bg-secondary text-secondary-foreground inline-flex items-center gap-1 px-1.5 py-0.5 text-xs break-all',
        className,
      )}
    >
      <span className="break-all">{children}</span>
      {onRemove && (
        <button onClick={onRemove} className="hover:text-destructive shrink-0 transition-colors">
          <XIcon className="size-3" />
        </button>
      )}
    </span>
  )
}
