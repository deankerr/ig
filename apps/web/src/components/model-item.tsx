import type { Model } from "@/hooks/use-all-models"

function formatPrice(unitPrice: number | null, unit: string | null): string {
  if (unitPrice == null) return ""
  const decimals = Math.max(2, unitPrice.toString().split(".")[1]?.length ?? 0)
  return `$${unitPrice.toFixed(decimals)}/${unit ?? "unit"}`
}

export function ModelItem({ model }: { model: Model }) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0 w-full">
      <div className="flex items-center juxstify-between gap-2 font-mono">
        <span className="truncate">{model.endpointId}</span>
        <span className="text-muted-foreground ml-auto truncate">{model.displayName}</span>
      </div>
      <div className="flex items-center gap-2 text-muted-foreground">
        <span className="shrink-0 whitespace-pre">{model.category.padEnd(16)}</span>
        {model.unitPrice != null && (
          <span className="shrink-0">{formatPrice(model.unitPrice, model.unit)}</span>
        )}
      </div>
    </div>
  )
}
