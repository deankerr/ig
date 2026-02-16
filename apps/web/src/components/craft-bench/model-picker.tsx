import { useCallback, useState } from 'react'

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { useDebounce } from '@/hooks/use-debounce'
import { useModelSearch } from '@/lib/queries'

import { ModelItem } from '../shared/model-item'

type ModelPickerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (air: string) => void
}

export function ModelPicker({ open, onOpenChange, onSelect }: ModelPickerProps) {
  const [query, setQuery] = useState('')
  const debouncedQuery = useDebounce(query, 300)

  const searchResults = useModelSearch(debouncedQuery)

  const isSearching = debouncedQuery.length >= 2

  const handleSelect = useCallback(
    (air: string) => {
      onSelect(air)
      onOpenChange(false)
    },
    [onSelect, onOpenChange],
  )

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Select Model"
      description="Search for a model by name, architecture, or AIR identifier"
      shouldFilter={false}
      className="sm:max-w-xl"
    >
      <CommandInput placeholder="Search models..." value={query} onValueChange={setQuery} />
      <CommandList className="max-h-[500px]">
        <CommandEmpty>
          {!isSearching
            ? 'Type to search models...'
            : searchResults.isFetching
              ? 'Searching...'
              : 'No models found.'}
        </CommandEmpty>

        {/* Search results */}
        {isSearching && searchResults.data && (
          <CommandGroup heading="Search Results">
            {searchResults.data.results.map((model) => (
              <CommandItem
                key={model.air}
                value={model.air}
                asChild
                onSelect={() => handleSelect(model.air)}
              >
                <ModelItem model={model} />
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  )
}
