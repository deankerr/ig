import { cn } from '@/lib/utils'

type Props = {
  children: React.ReactNode
  className?: string
}

export function PageHeader({ children, className }: Props) {
  return (
    <div className={cn('border-border bg-card/95 border-b px-4 py-3 backdrop-blur-sm', className)}>
      {children}
    </div>
  )
}
