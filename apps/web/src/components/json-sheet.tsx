import { CheckIcon, CopyIcon } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetBody, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"

type JsonSheetProps = {
  data: unknown
  title?: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function JsonSheet({ data, title, open, onOpenChange }: JsonSheetProps) {
  const [copied, setCopied] = useState(false)
  const json = JSON.stringify(data, null, 2)

  async function handleCopy() {
    await navigator.clipboard.writeText(json)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="max-w-xl">
        <SheetHeader className="flex-row items-center justify-between gap-2 pr-12">
          <SheetTitle className="font-mono truncate">{title ?? "JSON"}</SheetTitle>
          <Button variant="ghost" size="sm" onClick={handleCopy} className="shrink-0">
            {copied ? (
              <>
                <CheckIcon data-icon="inline-start" className="text-status-ready" />
                <span className="text-status-ready">copied</span>
              </>
            ) : (
              <>
                <CopyIcon data-icon="inline-start" />
                copy
              </>
            )}
          </Button>
        </SheetHeader>
        <SheetBody>
          <pre className="text-xs font-mono whitespace-pre-wrap break-all">{json}</pre>
        </SheetBody>
      </SheetContent>
    </Sheet>
  )
}
