import type { RunwareModel } from '@ig/server'

import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from '@/components/ui/item'

import { Badge } from '../ui/badge'

export function ModelItem({
  model,
  showBadges = true,
  ...props
}: { model: RunwareModel; showBadges?: boolean } & React.ComponentProps<typeof Item>) {
  return (
    <Item {...props}>
      <ItemMedia variant="image" className="rounded">
        {model.heroImage ? (
          <img src={model.heroImage} alt="" loading="lazy" />
        ) : (
          <div className="bg-muted size-full border" />
        )}
      </ItemMedia>

      <ItemContent>
        <ItemTitle>{model.name}</ItemTitle>
        <ItemDescription>{model.version}</ItemDescription>
      </ItemContent>

      {showBadges && (
        <div
          data-slot="model-badges"
          className="line-clamp-3 w-full items-center space-y-1 space-x-1"
        >
          <Badge variant="secondary">{model.architecture}</Badge>
          <Badge variant="secondary">{model.air}</Badge>
          {model.tags.map((tag) => (
            <Badge key={tag} variant="outline">
              {tag}
            </Badge>
          ))}
        </div>
      )}
    </Item>
  )
}
