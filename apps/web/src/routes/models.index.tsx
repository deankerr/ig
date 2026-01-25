import { useState, useMemo, useDeferredValue } from "react"
import { useMutation } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { Search, CloudDownload, ChevronDown } from "lucide-react"
import { toast } from "sonner"

import { PageHeader, PageContent } from "@/components/layout"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { client } from "@/utils/orpc"
import { Table, TableHeader, TableBody, TableRow, TableCell } from "@/components/ui/table"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetBody } from "@/components/ui/sheet"
import { SortableTableHead } from "@/components/sortable-table-head"
import { TimeAgo } from "@/components/time-ago"
import { filterModels } from "@/lib/fuzzy-search"
import { useSortable } from "@/hooks/use-sortable"
import { Copyable } from "@/components/copyable"
import { useAllModels, type Model } from "@/hooks/use-all-models"

export const Route = createFileRoute("/models/")({
  component: ModelsPage,
})

type SortKey = keyof Model

function formatPrice(unitPrice: number | null): string {
  if (unitPrice == null) return "\u2014"
  // Show all significant digits, but minimum 2 decimal places
  const str = unitPrice.toString()
  const decimals = str.includes(".") ? (str.split(".")[1]?.length ?? 0) : 0
  return `$${unitPrice.toFixed(Math.max(2, decimals))}`
}

function parseDate(value: string | Date | null | undefined): Date | null {
  if (value == null) return null
  return value instanceof Date ? value : new Date(value)
}

function getLatestSyncDate(model: Model): Date | null {
  const modelSync = parseDate(model.modelSyncedAt)
  const pricingSync = parseDate(model.pricingSyncedAt)
  if (!modelSync) return pricingSync
  if (!pricingSync) return modelSync
  return modelSync > pricingSync ? modelSync : pricingSync
}

function ModelsPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const deferredSearch = useDeferredValue(searchQuery)
  const [selectedModel, setSelectedModel] = useState<Model | null>(null)

  const { models, isLoading } = useAllModels()

  const syncMutation = useMutation({
    mutationFn: (params: { all?: boolean }) => client.models.startSync(params),
    onSuccess: (data) => {
      if (data.started) {
        toast.success("Model sync started")
      } else {
        toast.info(data.reason ?? "Sync already in progress")
      }
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  const filteredModels = useMemo(
    () => filterModels(models, deferredSearch),
    [models, deferredSearch],
  )

  const { sortedItems, sortConfig, toggleSort } = useSortable(filteredModels, {
    key: "upstreamCreatedAt" as SortKey,
    direction: "desc",
  })

  return (
    <div className="flex flex-col h-full">
      <PageHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-sm font-medium">models</h1>
            <span className="text-xs text-muted-foreground">
              {sortedItems.length}
              {deferredSearch && ` / ${models.length}`} models
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search models..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-[200px] pl-7"
              />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger
                className="inline-flex items-center justify-center gap-1 whitespace-nowrap text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-background shadow-xs hover:bg-accent hover:text-accent-foreground h-8 px-3"
                disabled={syncMutation.isPending}
              >
                <CloudDownload
                  className={`h-3 w-3 ${syncMutation.isPending ? "animate-pulse" : ""}`}
                />
                <ChevronDown className="h-3 w-3" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => syncMutation.mutate({})}>Sync</DropdownMenuItem>
                <DropdownMenuItem onClick={() => syncMutation.mutate({ all: true })}>
                  Sync all
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </PageHeader>

      <PageContent className="p-0">
        {sortedItems.length === 0 && !isLoading && (
          <div className="text-center py-12 text-muted-foreground text-sm">
            {deferredSearch ? "no models match your search" : "no models found"}
          </div>
        )}

        {sortedItems.length > 0 && (
          <Table>
            <TableHeader className="sticky bg-card top-0 inset-shadow-[0_-1px_var(--border)]">
              <TableRow>
                <SortableTableHead
                  sortKey="endpointId"
                  currentSort={sortConfig}
                  onSort={toggleSort}
                >
                  Endpoint ID
                </SortableTableHead>
                <SortableTableHead
                  sortKey="displayName"
                  currentSort={sortConfig}
                  onSort={toggleSort}
                >
                  Name
                </SortableTableHead>
                <SortableTableHead sortKey="category" currentSort={sortConfig} onSort={toggleSort}>
                  Category
                </SortableTableHead>
                <SortableTableHead sortKey="unitPrice" currentSort={sortConfig} onSort={toggleSort}>
                  Price
                </SortableTableHead>
                <SortableTableHead sortKey="unit" currentSort={sortConfig} onSort={toggleSort}>
                  Unit
                </SortableTableHead>
                <SortableTableHead
                  sortKey="upstreamCreatedAt"
                  currentSort={sortConfig}
                  onSort={toggleSort}
                >
                  Created
                </SortableTableHead>
                <SortableTableHead
                  sortKey="modelSyncedAt"
                  currentSort={sortConfig}
                  onSort={toggleSort}
                >
                  Synced
                </SortableTableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedItems.map((model) => (
                <TableRow
                  key={model.endpointId}
                  className="cursor-pointer"
                  onClick={() => setSelectedModel(model)}
                >
                  <TableCell className="font-mono max-w-[300px] truncate">
                    <Copyable text={model.endpointId}>{model.endpointId}</Copyable>
                  </TableCell>
                  <TableCell className="max-w-[250px] truncate">{model.displayName}</TableCell>
                  <TableCell>
                    <span className="px-1.5 py-0.5 bg-muted">{model.category}</span>
                  </TableCell>
                  <TableCell className="font-mono">{formatPrice(model.unitPrice)}</TableCell>
                  <TableCell className="text-muted-foreground">{model.unit ?? "\u2014"}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {parseDate(model.upstreamCreatedAt) ? (
                      <TimeAgo date={parseDate(model.upstreamCreatedAt)!} />
                    ) : (
                      "\u2014"
                    )}
                  </TableCell>
                  <TableCell
                    className={
                      model.syncError ? "text-destructive cursor-help" : "text-muted-foreground"
                    }
                    title={model.syncError ?? undefined}
                  >
                    {getLatestSyncDate(model) ? (
                      <TimeAgo date={getLatestSyncDate(model)!} />
                    ) : (
                      "\u2014"
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </PageContent>

      {/* Model detail sheet */}
      <Sheet open={!!selectedModel} onOpenChange={(open) => !open && setSelectedModel(null)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle className="font-mono">{selectedModel?.endpointId}</SheetTitle>
          </SheetHeader>
          <SheetBody>
            <pre className="text-xs font-mono whitespace-pre-wrap break-all">
              {JSON.stringify(selectedModel, null, 2)}
            </pre>
          </SheetBody>
        </SheetContent>
      </Sheet>
    </div>
  )
}
