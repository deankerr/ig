type PulsingDotProps = {
  color?: "pending" | "ready" | "failed"
  className?: string
}

export function PulsingDot({ color = "pending", className }: PulsingDotProps) {
  const colorClass = `bg-status-${color}`

  return (
    <span className={`relative flex h-2 w-2 ${className ?? ""}`}>
      <span
        className={`absolute inline-flex h-full w-full animate-ping rounded-full ${colorClass} opacity-75`}
      />
      <span className={`relative inline-flex h-2 w-2 rounded-full ${colorClass}`} />
    </span>
  )
}
