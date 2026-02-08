import { useState, useCallback } from 'react'

import { cn } from '@/lib/utils'

type CopyableProps = React.ComponentProps<'span'> & {
  text: string
}

export function Copyable({ text, className, children, ...props }: CopyableProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 600)
  }, [text])

  return (
    <span
      className={cn(
        'cursor-pointer transition-colors hover:brightness-110',
        copied && 'animate-copy-pulse',
        className,
      )}
      onClick={(e) => {
        e.stopPropagation()
        void handleCopy()
      }}
      {...props}
    >
      {children}
    </span>
  )
}
