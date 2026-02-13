import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'

import { PulsingDot } from '@/components/shared/pulsing-dot'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { healthQueryOptions } from '@/lib/queries'
import * as storage from '@/lib/storage'
import { serverUrl } from '@/lib/utils'

export function ServerStatus() {
  const [open, setOpen] = useState(false)
  const [key, setKey] = useState('')
  const [hasKey, setHasKey] = useState(() => !!storage.getApiKey())

  const health = useQuery(healthQueryOptions())

  // Determine dot color: yellow (pending) if no key, green if healthy, red if failed
  const dotColor = !hasKey
    ? 'pending'
    : health.isSuccess
      ? 'ready'
      : health.isError
        ? 'failed'
        : 'pending'
  const dotPulse = health.isFetching || !hasKey

  function handleSave() {
    if (!key.trim()) {
      toast.error('API key cannot be empty')
      return
    }
    storage.setApiKey(key.trim())
    setHasKey(true)
    setKey('')
    setOpen(false)
    toast.success('API key saved')
  }

  function handleClear() {
    storage.clearApiKey()
    setHasKey(false)
    setKey('')
    setOpen(false)
    toast.success('API key cleared')
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground gap-2"
            title={hasKey ? 'API key set' : 'No API key'}
          />
        }
      >
        <PulsingDot color={dotColor} pulse={dotPulse} size="sm" />
        <span className="text-xs">{serverUrl.host}</span>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-mono text-base">api key</DialogTitle>
          <DialogDescription className="text-xs">
            Required for mutations (create, delete, regenerate).
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Input
            type="password"
            placeholder={hasKey ? '••••••••' : 'paste api key'}
            value={key}
            onChange={(e) => setKey(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            className="font-mono text-sm"
          />
        </div>
        <DialogFooter className="gap-2">
          {hasKey && (
            <Button variant="outline" size="sm" onClick={handleClear}>
              clear
            </Button>
          )}
          <Button size="sm" onClick={handleSave}>
            save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
