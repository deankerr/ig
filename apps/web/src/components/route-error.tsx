import type { ErrorComponentProps } from '@tanstack/react-router'
import { useRouter } from '@tanstack/react-router'

import { ErrorBoundaryUi } from './elements/devtools/error-boundary-ui'

export function RouteError({ error, info }: ErrorComponentProps) {
  const router = useRouter()

  return (
    <div className="flex h-full items-center justify-center p-4">
      <ErrorBoundaryUi
        error={error}
        componentStack={info?.componentStack}
        resetError={() => router.invalidate()}
        className="w-full max-w-3xl"
      />
    </div>
  )
}
