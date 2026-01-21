import { useQuery } from "@tanstack/react-query"
import { createFileRoute, Link } from "@tanstack/react-router"

import { StatusBadge } from "@/components/generations/status-badge"
import { TimeAgo } from "@/components/time-ago"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { client, orpc } from "@/utils/orpc"

export const Route = createFileRoute("/")({
  component: StatusDashboard,
})

function StatusDashboard() {
  const healthCheck = useQuery(orpc.healthCheck.queryOptions())

  const recentQuery = useQuery({
    queryKey: ["generations", "recent"],
    queryFn: () => client.generations.list({ limit: 5 }),
  })

  const pendingQuery = useQuery({
    queryKey: ["generations", "pending"],
    queryFn: () => client.generations.list({ status: "pending", limit: 100 }),
  })

  const failedQuery = useQuery({
    queryKey: ["generations", "failed"],
    queryFn: () => client.generations.list({ status: "failed", limit: 100 }),
  })

  const tagsQuery = useQuery({
    queryKey: ["generations", "tags"],
    queryFn: () => client.generations.listTags(),
  })

  const pendingCount = pendingQuery.data?.items.length ?? 0
  const failedCount = failedQuery.data?.items.length ?? 0
  const tagCount = tagsQuery.data?.tags.length ?? 0

  return (
    <div className="container mx-auto max-w-4xl px-4 py-4">
      <h1 className="mb-6 text-xl font-semibold">ig Status</h1>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">API Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <div
                className={`h-2 w-2 rounded-full ${
                  healthCheck.isLoading
                    ? "bg-yellow-500"
                    : healthCheck.data
                      ? "bg-green-500"
                      : "bg-red-500"
                }`}
              />
              <span className="text-lg font-semibold">
                {healthCheck.isLoading ? "Checking" : healthCheck.data ? "Connected" : "Offline"}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">{pendingCount}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Failed</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-lg font-semibold ${failedCount > 0 ? "text-destructive" : ""}`}>
              {failedCount}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Tags</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">{tagCount}</p>
          </CardContent>
        </Card>
      </div>

      <div className="mb-6 flex gap-4">
        <Link
          to="/generations"
          className="inline-flex h-8 items-center justify-center rounded-none border border-border bg-background px-3 text-xs font-medium transition-colors hover:bg-muted"
        >
          View All Generations
        </Link>
        <Link
          to="/playground"
          className="inline-flex h-8 items-center justify-center rounded-none bg-primary px-3 text-xs font-medium text-primary-foreground"
        >
          Playground
        </Link>
      </div>

      <div className="rounded border">
        <div className="border-b px-4 py-2">
          <h2 className="text-sm font-medium">Recent Generations</h2>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead className="w-[100px]">Status</TableHead>
              <TableHead>Endpoint</TableHead>
              <TableHead className="w-[100px]">Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {recentQuery.isLoading && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  Loading...
                </TableCell>
              </TableRow>
            )}
            {recentQuery.data?.items.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  No generations yet
                </TableCell>
              </TableRow>
            )}
            {recentQuery.data?.items.map((generation) => (
              <TableRow key={generation.id}>
                <TableCell className="font-mono text-sm">
                  <Link
                    to="/generations/$id"
                    params={{ id: generation.id }}
                    className="hover:underline"
                  >
                    {generation.id.slice(0, 8)}...{generation.id.slice(-4)}
                  </Link>
                </TableCell>
                <TableCell>
                  <StatusBadge status={generation.status} />
                </TableCell>
                <TableCell className="font-mono text-sm">{generation.endpoint}</TableCell>
                <TableCell>
                  <TimeAgo
                    date={new Date(generation.createdAt)}
                    className="text-sm text-muted-foreground"
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
