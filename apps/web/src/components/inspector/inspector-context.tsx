import { useNavigate } from '@tanstack/react-router'
import { createContext, use, useCallback, useMemo } from 'react'
import { toast } from 'sonner'

import { setCraftBenchInput } from '@/components/craft-bench'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'

type InspectorContextValue = {
  mode: 'artifact' | 'generation'
  id: string
  close: () => void
  sendToBench: (input: Record<string, unknown>) => void
  copy: (text: string, message?: string) => void
}

const InspectorContext = createContext<InspectorContextValue | null>(null)

export function useInspector() {
  const ctx = use(InspectorContext)
  if (!ctx) throw new Error('useInspector must be used within InspectorProvider')
  return ctx
}

type InspectorProviderProps = {
  mode: 'artifact' | 'generation'
  id: string
  children: React.ReactNode
}

export function InspectorProvider({ mode, id, children }: InspectorProviderProps) {
  const navigate = useNavigate({ from: '/' })
  const copy = useCopyToClipboard()

  const close = useCallback(() => {
    if (mode === 'artifact') {
      void navigate({ search: (prev) => ({ ...prev, artifact: undefined }) })
    } else {
      void navigate({ search: (prev) => ({ ...prev, generation: undefined }) })
    }
  }, [mode, navigate])

  const sendToBench = useCallback((input: Record<string, unknown>) => {
    setCraftBenchInput(input)
    toast.success('Sent to craft bench')
  }, [])

  const value = useMemo(
    () => ({ mode, id, close, sendToBench, copy }),
    [mode, id, close, sendToBench, copy],
  )

  return <InspectorContext value={value}>{children}</InspectorContext>
}
