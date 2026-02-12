import { useNavigate } from '@tanstack/react-router'

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

export function ViewToggle({ value }: { value: 'artifacts' | 'generations' }) {
  const navigate = useNavigate({ from: '/' })

  return (
    <Tabs
      value={value}
      onValueChange={(v) => navigate({ search: (prev) => ({ ...prev, view: v }) })}
    >
      <TabsList variant="line">
        <TabsTrigger value="artifacts">artifacts</TabsTrigger>
        <TabsTrigger value="generations">generations</TabsTrigger>
      </TabsList>
    </Tabs>
  )
}
