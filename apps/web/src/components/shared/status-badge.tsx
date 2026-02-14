import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const STATUS_STYLES: Record<string, string> = {
  ready: 'bg-status-ready/15 text-status-ready border-status-ready/30',
  completed: 'bg-status-ready/15 text-status-ready border-status-ready/30',
  pending: 'bg-status-pending/15 text-status-pending border-status-pending/30',
  processing: 'bg-status-pending/15 text-status-pending border-status-pending/30',
  failed: 'bg-status-failed/15 text-status-failed border-status-failed/30',
  error: 'bg-status-failed/15 text-status-failed border-status-failed/30',
}

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <Badge className={cn(STATUS_STYLES[status] ?? STATUS_STYLES.pending, className)}>
      {status}
    </Badge>
  )
}
