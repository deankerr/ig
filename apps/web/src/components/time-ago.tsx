import { useEffect, useState } from "react"

const INTERVALS = [
  { label: "y", seconds: 31536000 },
  { label: "mo", seconds: 2592000 },
  { label: "d", seconds: 86400 },
  { label: "h", seconds: 3600 },
  { label: "m", seconds: 60 },
  { label: "s", seconds: 1 },
] as const

function getTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)

  if (seconds < 5) return "just now"

  for (const interval of INTERVALS) {
    const count = Math.floor(seconds / interval.seconds)
    if (count >= 1) {
      return `${count}${interval.label} ago`
    }
  }

  return "just now"
}

export function TimeAgo({ date: input, className }: { date: Date; className?: string }) {
  const date = new Date(input)
  const [timeAgo, setTimeAgo] = useState(() => getTimeAgo(date))

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeAgo(getTimeAgo(date))
    }, 10000)

    return () => clearInterval(timer)
  }, [date])

  return (
    <time dateTime={date.toISOString()} title={date.toLocaleString()} className={className}>
      {timeAgo}
    </time>
  )
}
