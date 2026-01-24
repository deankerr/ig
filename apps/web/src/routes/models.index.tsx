import { useState, useMemo, useDeferredValue } from "react"
import { useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { RefreshCw, Search } from "lucide-react"

import { PageHeader, PageContent } from "@/components/layout"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Table, TableHeader, TableBody, TableRow, TableCell } from "@/components/ui/table"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetBody } from "@/components/ui/sheet"
import { SortableTableHead } from "@/components/sortable-table-head"
import { TimeAgo } from "@/components/time-ago"
import { client, queryClient } from "@/utils/orpc"
import { getModelsCache, setModelsCache } from "@/lib/models-cache"
import { filterModels } from "@/lib/fuzzy-search"
import { useSortable } from "@/hooks/use-sortable"
import { Copyable } from "@/components/copyable"

export const Route = createFileRoute("/models/")({
  component: ModelsPage,
})

type Model = Awaited<ReturnType<typeof client.models.listAll>>["items"][number]
type SortKey = keyof Model

function formatPrice(unitPrice: number | null): string {
  if (unitPrice == null) return "\u2014"
  return `$${unitPrice}`
}

function parseDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value)
}

function ModelsPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const deferredSearch = useDeferredValue(searchQuery)
  const [selectedModel, setSelectedModel] = useState<Model | null>(null)

  const modelsQuery = useQuery({
    queryKey: ["models", "listAll"],
    queryFn: async () => {
      const data = await client.models.listAll()
      setModelsCache(data)
      return data
    },
    initialData: () => getModelsCache<Model>(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  const items = modelsQuery.data?.items ?? []

  const filteredModels = useMemo(() => filterModels(items, deferredSearch), [items, deferredSearch])

  const { sortedItems, sortConfig, toggleSort } = useSortable(filteredModels, {
    key: "upstreamCreatedAt" as SortKey,
    direction: "desc",
  })

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["models", "listAll"] })
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-sm font-medium">models</h1>
            <span className="text-xs text-muted-foreground">
              {sortedItems.length}
              {deferredSearch && ` / ${modelsQuery.data?.items.length ?? 0}`} models
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
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={modelsQuery.isFetching}
            >
              <RefreshCw className={`h-3 w-3 ${modelsQuery.isFetching ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      </PageHeader>

      <PageContent className="p-0">
        {sortedItems.length === 0 && !modelsQuery.isLoading && (
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
                  sortKey="localUpdatedAt"
                  currentSort={sortConfig}
                  onSort={toggleSort}
                >
                  Updated
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
                  <TableCell className="font-mono">
                    {formatPrice(model.unitPrice)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {model.unit ?? "\u2014"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    <TimeAgo date={parseDate(model.upstreamCreatedAt)} />
                  </TableCell>
                  <TableCell
                    className={
                      model.syncError ? "text-destructive cursor-help" : "text-muted-foreground"
                    }
                    title={model.syncError ?? undefined}
                  >
                    <TimeAgo date={parseDate(model.localUpdatedAt)} />
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
