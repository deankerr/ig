import { useQuery } from '@tanstack/react-query'
import { LayoutGridIcon, ListIcon, XIcon } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { PageHeader } from '@/components/layout'
import {
  Autocomplete,
  AutocompleteEmpty,
  AutocompleteInput,
  AutocompleteItem,
  AutocompleteList,
  AutocompletePopup,
} from '@/components/ui/autocomplete'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ButtonGroup } from '@/components/ui/button-group'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { generationTagsQueryOptions } from '@/queries/generations'

export function GenerationFilters({
  viewMode,
  onViewModeChange,
  modelFilter,
  onModelFilterChange,
  tagFilters,
  onTagFiltersChange,
  statusFilter,
  onStatusFilterChange,
  totalLoaded,
}: {
  viewMode: 'grid' | 'list'
  onViewModeChange: (mode: 'grid' | 'list') => void
  modelFilter: string | undefined
  onModelFilterChange: (model: string | undefined) => void
  tagFilters: string[]
  onTagFiltersChange: (tags: string[]) => void
  statusFilter: string
  onStatusFilterChange: (status: 'all' | 'pending' | 'ready' | 'failed') => void
  totalLoaded: number
}) {
  const [modelInput, setModelInput] = useState(modelFilter ?? '')
  const [tagInput, setTagInput] = useState('')

  useEffect(() => {
    setModelInput(modelFilter ?? '')
  }, [modelFilter])

  const tagsQuery = useQuery(generationTagsQueryOptions())

  const availableTags = useMemo(() => {
    const all = tagsQuery.data?.tags ?? []
    return all.filter((t) => !tagFilters.includes(t))
  }, [tagsQuery.data?.tags, tagFilters])

  const filteredTags = useMemo(() => {
    if (!tagInput) return availableTags
    const lower = tagInput.toLowerCase()
    return availableTags.filter((t) => t.toLowerCase().includes(lower))
  }, [availableTags, tagInput])

  return (
    <PageHeader>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <h1 className="text-sm font-medium">generations</h1>
          <span className="text-muted-foreground text-xs">{totalLoaded} loaded</span>
          <ButtonGroup>
            <Button
              size="icon-sm"
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              onClick={() => {
                onViewModeChange('grid')
                localStorage.setItem('generations-view-mode', 'grid')
              }}
              aria-label="Grid view"
            >
              <LayoutGridIcon />
            </Button>
            <Button
              size="icon-sm"
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              onClick={() => {
                onViewModeChange('list')
                localStorage.setItem('generations-view-mode', 'list')
              }}
              aria-label="List view"
            >
              <ListIcon />
            </Button>
          </ButtonGroup>
        </div>
        <div className="flex items-center gap-2">
          <Input
            placeholder="model"
            className="h-7 w-[220px] font-mono"
            value={modelInput}
            onChange={(e) => {
              setModelInput(e.target.value)
              if (!e.target.value.trim()) onModelFilterChange(undefined)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && modelInput.trim()) {
                e.preventDefault()
                onModelFilterChange(modelInput.trim())
              }
            }}
          />

          <Autocomplete autoHighlight={false}>
            <AutocompleteInput
              placeholder="add tag"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && tagInput.trim()) {
                  e.preventDefault()
                  const tag = tagInput.trim()
                  if (!tagFilters.includes(tag)) {
                    onTagFiltersChange([...tagFilters, tag])
                  }
                  setTagInput('')
                }
              }}
              className="h-7 w-[220px]"
            />
            <AutocompletePopup>
              <AutocompleteList>
                {filteredTags.map((tag) => (
                  <AutocompleteItem
                    key={tag}
                    value={tag}
                    onClick={() => {
                      if (!tagFilters.includes(tag)) {
                        onTagFiltersChange([...tagFilters, tag])
                      }
                      setTagInput('')
                    }}
                  >
                    {tag}
                  </AutocompleteItem>
                ))}
              </AutocompleteList>
              <AutocompleteEmpty />
            </AutocompletePopup>
          </Autocomplete>

          {tagFilters.map((tag) => (
            <Badge
              key={tag}
              variant="secondary"
              className="h-7 cursor-pointer gap-1 text-xs"
              onClick={() => onTagFiltersChange(tagFilters.filter((t) => t !== tag))}
            >
              {tag}
              <XIcon className="size-3" />
            </Badge>
          ))}

          <Select
            value={statusFilter}
            onValueChange={(v) =>
              v && onStatusFilterChange(v as 'all' | 'pending' | 'ready' | 'failed')
            }
          >
            <SelectTrigger className="h-7 w-[100px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">all</SelectItem>
              <SelectItem value="pending">pending</SelectItem>
              <SelectItem value="ready">ready</SelectItem>
              <SelectItem value="failed">failed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </PageHeader>
  )
}
