import { cn } from '@/lib/utils'

type Props = {
  main: React.ReactNode
  sidebar: React.ReactNode
  sidebarWidth?: string
}

export function SidebarLayout({ main, sidebar, sidebarWidth = 'w-80' }: Props) {
  return (
    <div className="flex h-full">
      <div className="flex min-w-0 flex-1 flex-col">{main}</div>
      <aside className={cn('border-border bg-card overflow-y-auto border-l', sidebarWidth)}>
        {sidebar}
      </aside>
    </div>
  )
}
