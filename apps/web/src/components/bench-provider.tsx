import { createContext, useCallback, useContext, useState } from 'react'

type BenchContextValue = {
  open: boolean
  toggle: () => void
  close: () => void
}

const BenchContext = createContext<BenchContextValue | null>(null)

export function useBench() {
  const ctx = useContext(BenchContext)
  if (!ctx) throw new Error('useBench must be used within BenchProvider')
  return ctx
}

export function BenchProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)

  const toggle = useCallback(() => {
    setOpen((prev) => !prev)
  }, [])

  const close = useCallback(() => {
    setOpen(false)
  }, [])

  return <BenchContext.Provider value={{ open, toggle, close }}>{children}</BenchContext.Provider>
}
