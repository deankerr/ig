import { ClipboardIcon } from 'lucide-react'
import { createContext, useCallback, useContext, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Sheet, SheetBody, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'

type JsonSheetState = { data: unknown; title: string } | null

type JsonSheetContextValue = {
  open: (data: unknown, title?: string) => void
}

const JsonSheetContext = createContext<JsonSheetContextValue | null>(null)

export function useJsonSheet() {
  const ctx = useContext(JsonSheetContext)
  if (!ctx) throw new Error('useJsonSheet must be used within JsonSheetProvider')
  return ctx
}

export function JsonSheetProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<JsonSheetState>(null)
  const copy = useCopyToClipboard()

  const open = useCallback((data: unknown, title?: string) => {
    setState({ data, title: title ?? 'JSON' })
  }, [])

  const json = state ? JSON.stringify(state.data, null, 2) : ''

  return (
    <JsonSheetContext.Provider value={{ open }}>
      {children}
      <Sheet open={!!state} onOpenChange={(open) => !open && setState(null)}>
        <SheetContent className="max-w-xl">
          <SheetHeader className="flex-row items-center justify-between gap-2 pr-12">
            <SheetTitle className="truncate font-mono">{state?.title ?? 'JSON'}</SheetTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => copy(json, 'Copied JSON')}
              className="shrink-0"
            >
              <ClipboardIcon data-icon="inline-start" />
              copy
            </Button>
          </SheetHeader>
          <SheetBody>
            <pre className="font-mono text-xs break-all whitespace-pre-wrap">{json}</pre>
          </SheetBody>
        </SheetContent>
      </Sheet>
    </JsonSheetContext.Provider>
  )
}
