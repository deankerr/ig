import { cn } from '@/lib/utils'

type Props = {
  children: React.ReactNode
  className?: string
}

export function PageContent({ children, className }: Props) {
  return <div className={cn('flex-1 overflow-auto p-4', className)}>{children}</div>
}
