import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { deleteGenerationOptions, invalidateGenerations } from '@/queries/generations'

export function DeleteGenerationDialog({
  generationId,
  open,
  onOpenChange,
  onDeleted,
}: {
  generationId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onDeleted?: () => void
}) {
  const deleteMutation = useMutation({
    ...deleteGenerationOptions(),
    onSuccess: () => {
      invalidateGenerations()
      onOpenChange(false)
      onDeleted?.()
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to delete generation')
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-mono text-base">delete generation</DialogTitle>
          <DialogDescription className="text-xs">
            This will permanently delete the generation and its output file.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            cancel
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => deleteMutation.mutate({ id: generationId })}
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? 'deleting...' : 'delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
