import { LayoutGridIcon, LayoutListIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { DisplayMode } from '@/lib/storage'

export function DisplayToggle({
  value,
  onChange,
}: {
  value: DisplayMode
  onChange: (mode: DisplayMode) => void
}) {
  return (
    <div className="flex gap-0.5">
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              size="icon-xs"
              variant={value === 'grid' ? 'secondary' : 'ghost'}
              onClick={() => onChange('grid')}
            />
          }
        >
          <LayoutGridIcon />
        </TooltipTrigger>
        <TooltipContent>Grid view</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              size="icon-xs"
              variant={value === 'list' ? 'secondary' : 'ghost'}
              onClick={() => onChange('list')}
            />
          }
        >
          <LayoutListIcon />
        </TooltipTrigger>
        <TooltipContent>List view</TooltipContent>
      </Tooltip>
    </div>
  )
}
