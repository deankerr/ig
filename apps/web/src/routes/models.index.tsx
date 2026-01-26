import { useMutation } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import {
  ChevronDownIcon,
  CloudDownloadIcon,
  ExternalLinkIcon,
  InfoIcon,
  MoreHorizontalIcon,
  SearchIcon,
} from "lucide-react"
import { useDeferredValue, useMemo, useState } from "react"
import { toast } from "sonner"

import { Copyable } from "@/components/copyable"
import { PageContent, PageHeader } from "@/components/layout"
import { SortableTableHead } from "@/components/sortable-table-head"
import { TimeAgo } from "@/components/time-ago"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Sheet, SheetBody, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useAllModels, type Model } from "@/hooks/use-all-models"
import { useSortable } from "@/hooks/use-sortable"
import { filterModels } from "@/lib/fuzzy-search"
import { client } from "@/utils/orpc"

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
            <InputGroup className="w-[200px] h-8">
              <InputGroupAddon>
                <SearchIcon className="size-3" />
              </InputGroupAddon>
              <InputGroupInput
                type="text"
                placeholder="Search models..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </InputGroup>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="outline" size="sm" disabled={syncMutation.isPending}>
                    <CloudDownloadIcon className={syncMutation.isPending ? "animate-pulse" : ""} />
                    <ChevronDownIcon />
                  </Button>
                }
              />
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
            <TableHeader className="sticky bg-card top-0 inset-shadow-[0_-1px_var(--border)] z-10">
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
                <TableHead className="w-10">
                  <span className="sr-only">Action Menu</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedItems.map((model) => (
                <TableRow key={model.endpointId}>
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
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button size="icon-sm" variant="ghost">
                            <MoreHorizontalIcon />
                          </Button>
                        }
                      />
                      <DropdownMenuContent>
                        <DropdownMenuItem onClick={() => setSelectedModel(model)}>
                          <InfoIcon />
                          View details
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            window.open(
                              `https://fal.ai/models/${model.endpointId}`,
                              "_blank",
                              "noopener",
                            )
                          }
                        >
                          <ExternalLinkIcon />
                          Open on fal.ai
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
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
