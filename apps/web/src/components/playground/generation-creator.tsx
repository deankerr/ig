import { useMutation } from '@tanstack/react-query'
import { SendIcon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { SidebarLayout, PageHeader, PageContent } from '@/components/layout'
import { Tag } from '@/components/tag'
import { TagInput } from '@/components/tag-input'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { normalizeSlug } from '@/lib/format'
import { createGenerationOptions, invalidateGenerations } from '@/queries/generations'

const DEFAULT_INPUT = `{
  "prompt": ""
}`

export function GenerationCreator({
  onSuccess,
}: {
  onSuccess?: (generation: { id: string }) => void
}) {
  const [model, setModel] = useState('fal-ai/flux/schnell')
  const [inputJson, setInputJson] = useState(DEFAULT_INPUT)
  const [tags, setTags] = useState<string[]>([])
  const [slug, setSlug] = useState('')
  const [autoAspectRatio, setAutoAspectRatio] = useState(false)
  const [jsonError, setJsonError] = useState<string | null>(null)

  const createMutation = useMutation({
    ...createGenerationOptions(),
    onSuccess: (data) => {
      void invalidateGenerations()
      toast.success('Generation submitted')
      onSuccess?.(data)
    },
    onError: (error) => {
      if (error.message === 'Invalid JSON input') {
        setJsonError('Invalid JSON format')
      } else {
        toast.error(error.message || 'Failed to submit generation')
      }
    },
  })

  function handleSubmit() {
    let parsedInput: Record<string, unknown>
    try {
      parsedInput = JSON.parse(inputJson)
      setJsonError(null)
    } catch {
      setJsonError('Invalid JSON format')
      return
    }

    createMutation.mutate({
      provider: model.includes('@') ? 'runware' : 'fal',
      model,
      input: parsedInput,
      tags,
      slug: slug.trim() || undefined,
      autoAspectRatio: autoAspectRatio || undefined,
    })
  }

  function handleRemoveTag(tag: string) {
    setTags(tags.filter((t) => t !== tag))
  }

  function handleJsonChange(value: string) {
    setInputJson(value)
    try {
      JSON.parse(value)
      setJsonError(null)
    } catch {
      setJsonError('Invalid JSON')
    }
  }

  return (
    <SidebarLayout
      sidebarWidth="w-64"
      main={
        <>
          <PageHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <h1 className="text-sm font-medium">playground</h1>
              </div>
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={createMutation.isPending || !!jsonError || !model.trim()}
                className="h-7 text-xs"
              >
                {createMutation.isPending ? (
                  'submitting...'
                ) : (
                  <>
                    <SendIcon data-icon="inline-start" />
                    submit
                  </>
                )}
              </Button>
            </div>
          </PageHeader>

          <PageContent className="flex flex-1 flex-col p-0">
            {/* Model selector */}
            <div className="border-border border-b p-4">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground w-16 text-xs">model</span>
                <div className="flex-1">
                  <Input
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    placeholder="fal-ai/... or civitai:...@..."
                    className="font-mono text-sm"
                  />
                </div>
              </div>
            </div>

            {/* JSON input */}
            <div className="flex min-h-[400px] flex-1 flex-col">
              <div className="border-border bg-muted/30 flex items-center justify-between border-b px-4 py-2">
                <span className="text-muted-foreground text-xs">input.json</span>
                {jsonError && <span className="text-destructive text-xs">{jsonError}</span>}
              </div>
              <textarea
                value={inputJson}
                onChange={(e) => handleJsonChange(e.target.value)}
                className="w-full flex-1 resize-none bg-transparent p-4 font-mono text-sm leading-relaxed focus:outline-none"
                placeholder='{"prompt": "..."}'
                spellCheck={false}
              />
            </div>
          </PageContent>
        </>
      }
      sidebar={
        <div className="flex h-full flex-col">
          {/* Slug */}
          <div className="border-border border-b p-4">
            <h3 className="text-muted-foreground mb-2 text-xs">slug</h3>
            <Input
              value={slug}
              onChange={(e) => setSlug(normalizeSlug(e.target.value))}
              placeholder="optional-url-slug"
              className="h-7 font-mono text-xs"
            />
          </div>

          {/* Options */}
          <div className="border-border border-b p-4">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={autoAspectRatio}
                onChange={(e) => setAutoAspectRatio(e.target.checked)}
                className="accent-primary size-3.5"
              />
              <span className="text-xs">auto aspect ratio</span>
            </label>
          </div>

          {/* Tags */}
          <div className="border-border border-b p-4">
            <h3 className="text-muted-foreground mb-2 text-xs">tags</h3>
            {tags.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {tags.map((tag) => (
                  <Tag key={tag} onRemove={() => handleRemoveTag(tag)}>
                    {tag}
                  </Tag>
                ))}
              </div>
            )}
            <TagInput
              onAdd={(tag) => {
                if (!tags.includes(tag)) {
                  setTags([...tags, tag])
                }
              }}
            />
          </div>
        </div>
      }
    />
  )
}
