import { KeyIcon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

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
import { clearApiKey, getApiKey, setApiKey } from '@/lib/orpc'

export function ApiKeySettings() {
  const [open, setOpen] = useState(false)
  const [key, setKey] = useState('')
  const hasKey = !!getApiKey()

  function handleSave() {
    if (!key.trim()) {
      toast.error('API key cannot be empty')
      return
    }
    setApiKey(key.trim())
    setKey('')
    setOpen(false)
    toast.success('API key saved')
  }

  function handleClear() {
    clearApiKey()
    setKey('')
    setOpen(false)
    toast.success('API key cleared')
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            size="icon-xs"
            variant="ghost"
            className={hasKey ? 'text-status-ready hover:text-status-ready/80' : ''}
            title={hasKey ? 'API key set' : 'No API key'}
          >
            <KeyIcon />
          </Button>
        }
      />
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
