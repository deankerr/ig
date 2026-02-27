import { Skeleton } from '@/components/ui/skeleton'
import { useModel } from '@/lib/queries'

/** Model display for inspector sidebars — hero image, name (line-clamped),
 *  architecture, and AIR identifier. */
export function ModelField({ air }: { air: string | null }) {
  const { data: model, isPending } = useModel(air || undefined)

  if (!air) return null

  return (
    <div className="flex flex-col gap-0.5 text-xs">
      <span className="text-muted-foreground">model</span>

      {isPending ? (
        <div className="flex items-center gap-2">
          <Skeleton className="size-8 shrink-0 rounded" />
          <div className="flex flex-col gap-1">
            <Skeleton className="h-3.5 w-28 rounded-sm" />
            <Skeleton className="h-3 w-16 rounded-sm" />
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-2">
          {model?.heroImage && (
            <img
              src={model.heroImage}
              alt=""
              className="size-8 shrink-0 rounded object-cover"
              loading="lazy"
            />
          )}
          <div className="flex min-w-0 flex-col">
            <span className="line-clamp-2 font-medium">{model?.name ?? air}</span>
            <span className="text-muted-foreground">{model?.version}</span>
          </div>
        </div>
      )}
    </div>
  )
}
