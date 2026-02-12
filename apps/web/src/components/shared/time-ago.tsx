import { useEffect, useState } from 'react'

const INTERVALS = [
  { label: 'y', seconds: 31536000 },
  { label: 'mo', seconds: 2592000 },
  { label: 'd', seconds: 86400 },
  { label: 'h', seconds: 3600 },
  { label: 'm', seconds: 60 },
  { label: 's', seconds: 1 },
] as const

function getTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000)

  if (seconds < 5) return 'just now'

  for (const interval of INTERVALS) {
    const count = Math.floor(seconds / interval.seconds)
    if (count >= 1) {
      return `${count}${interval.label} ago`
    }
  }

  return 'just now'
}

export function TimeAgo({ date, className }: { date: Date | string; className?: string }) {
  // Coerce to Date — localStorage persistence deserializes dates as strings
  const d = date instanceof Date ? date : new Date(date)
  const timestamp = d.getTime()
  const [timeAgo, setTimeAgo] = useState(() => getTimeAgo(timestamp))

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeAgo(getTimeAgo(timestamp))
    }, 10000)

    return () => clearInterval(timer)
  }, [timestamp])

  return (
    <time dateTime={d.toISOString()} title={d.toLocaleString()} className={className}>
      {timeAgo}
    </time>
  )
}
