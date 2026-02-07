import { Tag } from "@/components/tag"
import { Thumbnail } from "@/components/thumbnail"
import { TimeAgo } from "@/components/time-ago"
import { Item, ItemContent, ItemMedia, ItemTitle } from "@/components/ui/item"
import { formatDuration } from "@/lib/format"
import { formatFalEndpointId } from "@/lib/format-endpoint"
import type { Generation } from "@/types"

export function GenerationListItem({
  generation,
  onSelect,
}: {
  generation: Generation
  onSelect?: (id: string) => void
}) {
  const prompt = generation.input?.prompt as string | undefined

  const itemProps = onSelect
    ? {
        onClick: () => onSelect(generation.id),
        onKeyDown: (e: React.KeyboardEvent) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            onSelect(generation.id)
          }
        },
        role: "button" as const,
        tabIndex: 0,
        className: "cursor-pointer",
      }
    : {}

  return (
    <Item variant="outline" {...itemProps}>
      <ItemMedia className="w-[180px]">
        <Thumbnail
          generationId={generation.id}
          contentType={generation.contentType}
          status={generation.status}
          size={180}
          className="w-full object-cover h-[180px]"
        />
      </ItemMedia>
      <ItemContent className="justify-between h-full">
        <div className="flex items-center gap-2">
          <ItemTitle>{formatFalEndpointId(generation.model)}</ItemTitle>
          <span className="text-muted-foreground">·</span>
          <TimeAgo date={generation.createdAt} className=" text-muted-foreground" />
          {generation.completedAt && (
            <span className="text-muted-foreground">
              ({formatDuration(generation.createdAt, generation.completedAt)}s)
            </span>
          )}
        </div>
        <span className="font-mono text-muted-foreground">{generation.slug ?? generation.id}</span>
        {prompt && (
          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{prompt}</p>
        )}
        {generation.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {generation.tags.slice(0, 3).map((tag) => (
              <Tag key={tag} className="">
                {tag}
              </Tag>
            ))}
            {generation.tags.length > 3 && (
              <span className="text-muted-foreground">+{generation.tags.length - 3}</span>
            )}
          </div>
        )}
      </ItemContent>
    </Item>
  )
}
