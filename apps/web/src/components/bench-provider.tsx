import { createContext, useCallback, useContext, useState } from 'react'

type BenchContextValue = {
  open: boolean
  toggle: () => void
  close: () => void
  inflightIds: string[]
  addInflight: (id: string) => void
}

const BenchContext = createContext<BenchContextValue | null>(null)

export function useBench() {
  const ctx = useContext(BenchContext)
  if (!ctx) throw new Error('useBench must be used within BenchProvider')
  return ctx
}

export function BenchProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const [inflightIds, setInflightIds] = useState<string[]>([])

  const toggle = useCallback(() => {
    setOpen((prev) => !prev)
  }, [])

  const close = useCallback(() => {
    setOpen(false)
  }, [])

  const addInflight = useCallback((id: string) => {
    setInflightIds((prev) => [id, ...prev])
  }, [])

  return (
    <BenchContext.Provider value={{ open, toggle, close, inflightIds, addInflight }}>
      {children}
    </BenchContext.Provider>
  )
}
