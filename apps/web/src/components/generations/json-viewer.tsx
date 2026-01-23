import { useState } from "react"
import { Check, Copy, ChevronDown, ChevronRight } from "lucide-react"

import { cn } from "@/lib/utils"

export function JsonViewer({
  data,
  maxHeight = "400px",
  className,
  collapsible = false,
  defaultCollapsed = false,
  label,
}: {
  data: unknown
  maxHeight?: string
  className?: string
  collapsible?: boolean
  defaultCollapsed?: boolean
  label?: string
}) {
  const [copied, setCopied] = useState(false)
  const [collapsed, setCollapsed] = useState(defaultCollapsed)
  const json = JSON.stringify(data, null, 2)

  async function handleCopy() {
    await navigator.clipboard.writeText(json)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className={cn("group relative border border-border bg-card", className)}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-3 py-1.5 bg-muted/50">
        <div className="flex items-center gap-2">
          {collapsible && (
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="p-0.5 hover:text-primary transition-colors"
            >
              {collapsed ? (
                <ChevronRight className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
            </button>
          )}
          {label && <span className="text-xs text-muted-foreground">{label}</span>}
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 text-status-ready" />
              <span className="text-status-ready">copied</span>
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              <span>copy</span>
            </>
          )}
        </button>
      </div>

      {/* Content */}
      {!collapsed && (
        <div className="overflow-auto" style={{ maxHeight }}>
          <pre className="p-3 text-xs leading-relaxed">
            <code className="text-foreground">{json}</code>
          </pre>
        </div>
      )}
    </div>
  )
}

/**
 * Inline JSON display for small objects (like prompts)
 */
export function JsonInline({
  data,
  className,
  truncate = true,
  maxLength = 100,
}: {
  data: unknown
  className?: string
  truncate?: boolean
  maxLength?: number
}) {
  const json = typeof data === "string" ? data : JSON.stringify(data)
  const display = truncate && json.length > maxLength ? `${json.slice(0, maxLength)}...` : json

  return (
    <code
      className={cn("text-xs text-muted-foreground", className)}
      title={json.length > maxLength ? json : undefined}
    >
      {display}
    </code>
  )
}
