import { Skeleton } from '@/components/ui/skeleton'
import { useModel } from '@/lib/queries'
import { cn } from '@/lib/utils'

type ModelLabelProps = {
  air: string
  className?: string
}

/** Displays a model name with AIR fallback. Resolves from React Query cache
 *  (seeded by list queries) or fetches on demand via models.get endpoint. */
export function ModelLabel({ air, className }: ModelLabelProps) {
  const { data: model, isPending } = useModel(air || undefined)

  if (!air) return null

  if (isPending) return <Skeleton className={cn('h-3.5 w-20 rounded-sm', className)} />

  return <span className={cn('min-w-0 truncate', className)}>{model?.name ?? air}</span>
}
