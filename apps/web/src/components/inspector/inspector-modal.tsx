import { ArtifactInspector } from '@/components/inspector/artifact-inspector'
import { GenerationInspector } from '@/components/inspector/generation-inspector'
import { useInspector, InspectorProvider } from '@/components/inspector/inspector-context'
import { Dialog, DialogContent } from '@/components/ui/dialog'

type InspectorModalProps = { mode: 'artifact'; id: string } | { mode: 'generation'; id: string }

export function InspectorModal(props: InspectorModalProps) {
  return (
    <InspectorProvider mode={props.mode} id={props.id}>
      <InspectorDialog mode={props.mode} />
    </InspectorProvider>
  )
}

// Separate component so useInspector is available via context
function InspectorDialog({ mode }: { mode: 'artifact' | 'generation' }) {
  const { close } = useInspector()

  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent
        className="flex h-[90dvh] w-[95vw] max-w-none flex-col gap-0 p-0 sm:max-w-none"
        showCloseButton={false}
      >
        <div className="flex h-full flex-col">
          {mode === 'artifact' ? <ArtifactInspector /> : <GenerationInspector />}
        </div>
      </DialogContent>
    </Dialog>
  )
}
