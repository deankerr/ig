import { createFileRoute, useNavigate } from '@tanstack/react-router'

import { GenerationCreator } from '@/components/playground/generation-creator'

export const Route = createFileRoute('/playground')({
  component: PlaygroundPage,
})

function PlaygroundPage() {
  const navigate = useNavigate()

  return (
    <div className="h-full">
      <GenerationCreator
        onSuccess={(g) => navigate({ to: '/generations', search: { selected: g.id } })}
      />
    </div>
  )
}
