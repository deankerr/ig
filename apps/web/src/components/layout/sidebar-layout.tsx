import { cn } from "@/lib/utils"

type Props = {
  main: React.ReactNode
  sidebar: React.ReactNode
  sidebarWidth?: string
}

export function SidebarLayout({ main, sidebar, sidebarWidth = "w-80" }: Props) {
  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col min-w-0">{main}</div>
      <aside className={cn("overflow-y-auto border-l border-border bg-card", sidebarWidth)}>
        {sidebar}
      </aside>
    </div>
  )
}
