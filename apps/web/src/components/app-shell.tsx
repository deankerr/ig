import { useSearch } from '@tanstack/react-router'
import { FlaskConicalIcon } from 'lucide-react'

import { ApiKeySettings } from '@/components/api-key-settings'
import { ArtifactList } from '@/components/artifact-list'
import { useBench } from '@/components/bench-provider'
import { CraftBench } from '@/components/craft-bench'
import { GenerationList } from '@/components/generation-list'
import { InspectorModal } from '@/components/inspector'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { ViewToggle } from '@/components/view-toggle'
import { useMediaQuery } from '@/hooks/use-media-query'

export function AppShell() {
  const search = useSearch({ from: '/' })
  const bench = useBench()
  const isWide = useMediaQuery('(min-width: 1024px)')

  return (
    <div className="flex h-dvh flex-col">
      {/* Header */}
      <header className="border-border flex h-10 shrink-0 items-center gap-3 border-b px-3">
        <span className="text-sm font-semibold tracking-tight">ig</span>
        <ViewToggle value={search.view} />
        <div className="flex-1" />
        <Button size="sm" variant={bench.open ? 'secondary' : 'ghost'} onClick={bench.toggle}>
          <FlaskConicalIcon data-icon="inline-start" />
          craft bench
        </Button>
        <ApiKeySettings />
      </header>

      {/* Content area */}
      <div className="flex min-h-0 flex-1">
        <main
          className="min-w-0 flex-1 overflow-y-auto"
          style={isWide && bench.open ? { marginRight: 400 } : undefined}
        >
          {search.view === 'artifacts' ? <ArtifactList /> : <GenerationList />}
        </main>

        {/* Wide viewport: fixed sidebar panel */}
        {isWide && bench.open && (
          <aside className="border-border fixed top-10 right-0 bottom-0 w-[400px] border-l">
            <CraftBench />
          </aside>
        )}

        {/* Narrow viewport: sheet overlay */}
        {!isWide && (
          <Sheet open={bench.open} onOpenChange={(open) => !open && bench.close()}>
            <SheetContent showCloseButton={false} className="w-[400px] max-w-[400px] p-0">
              <CraftBench />
            </SheetContent>
          </Sheet>
        )}
      </div>

      {/* Detail modals */}
      {search.artifact && <InspectorModal mode="artifact" id={search.artifact} />}
      {search.generation && <InspectorModal mode="generation" id={search.generation} />}
    </div>
  )
}
