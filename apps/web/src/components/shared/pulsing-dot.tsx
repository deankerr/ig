import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const pulsingDotVariants = cva('relative inline-flex rounded-full', {
  variants: {
    color: {
      ready: 'bg-status-ready',
      pending: 'bg-status-pending',
      failed: 'bg-status-failed',
    },
    size: {
      sm: 'size-1.5',
      default: 'size-2',
    },
  },
  defaultVariants: {
    color: 'pending',
    size: 'default',
  },
})

type PulsingDotProps = VariantProps<typeof pulsingDotVariants> & {
  pulse?: boolean
  className?: string
}

export function PulsingDot({ color, size, pulse = true, className }: PulsingDotProps) {
  return (
    <span className={cn('relative flex', size === 'sm' ? 'size-1.5' : 'size-2', className)}>
      {pulse && (
        <span
          className={cn(
            pulsingDotVariants({ color, size }),
            'absolute h-full w-full animate-ping opacity-75',
          )}
        />
      )}
      <span className={cn(pulsingDotVariants({ color, size }))} />
    </span>
  )
}
