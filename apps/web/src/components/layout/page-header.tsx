import { cn } from "@/lib/utils"

type Props = {
  children: React.ReactNode
  className?: string
}

export function PageHeader({ children, className }: Props) {
  return (
    <div className={cn("border-b border-border px-4 py-3 bg-card/95 backdrop-blur-sm", className)}>
      {children}
    </div>
  )
}
