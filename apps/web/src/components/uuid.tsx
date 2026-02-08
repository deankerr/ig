import { useState } from 'react'

import { cn } from '@/lib/utils'

/**
 * Displays the last segment of a UUID (most distinctive part in UUIDv7).
 * Click to copy full UUID.
 */
export function UUID({ value, className }: { value: string; className?: string }) {
  const [copied, setCopied] = useState(false)

  // UUIDv7 format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
  // The last segment is the most distinctive part
  const lastSegment = value.split('-').pop() ?? value.slice(-12)

  async function handleCopy() {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <button
      onClick={handleCopy}
      className={cn(
        'hover:text-primary cursor-pointer font-mono text-sm tracking-[-0.02em] transition-colors',
        copied && 'text-status-ready',
        className,
      )}
      title={copied ? 'Copied!' : `Click to copy: ${value}`}
    >
      {copied ? 'copied' : lastSegment}
    </button>
  )
}
