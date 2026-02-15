import { XIcon } from 'lucide-react'

import { useInspector } from '@/components/inspector/inspector-context'
import { Button } from '@/components/ui/button'
import { DialogClose, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

// Header with title, action slots, and close button
export function InspectorHeader({
  title,
  children,
}: {
  title: string
  children?: React.ReactNode
}) {
  return (
    <div className="flex shrink-0 items-center border-b px-4 py-3">
      <DialogTitle className="font-mono text-sm">
        {title.includes('/') ? (
          <>
            {title.slice(0, title.indexOf('/'))}
            <span className="text-muted-foreground">/{title.slice(title.indexOf('/') + 1)}</span>
          </>
        ) : (
          title
        )}
      </DialogTitle>
      <div className="ml-auto flex items-center gap-1">
        {children}
        <HeaderDivider />
        <CloseButton />
      </div>
    </div>
  )
}

// Two-column body container
export function InspectorBody({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-0 flex-1">{children}</div>
}

// Left column: scrollable main content area
export function InspectorContent({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return <div className={cn('min-w-0 flex-1 overflow-y-auto', className)}>{children}</div>
}

// Right column: fixed-width metadata sidebar
export function InspectorSidebar({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-72 shrink-0 overflow-x-hidden overflow-y-auto border-l p-4">
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  )
}

// Internal: vertical divider between actions and close button
function HeaderDivider() {
  return <div className="bg-border mx-1 h-4 w-px" />
}

// Internal: close button wired to inspector context
function CloseButton() {
  const { close } = useInspector()

  return (
    <DialogClose render={<Button variant="ghost" size="icon-sm" onClick={close} />}>
      <XIcon />
      <span className="sr-only">Close</span>
    </DialogClose>
  )
}
