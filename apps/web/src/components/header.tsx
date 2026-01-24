import { useQuery } from "@tanstack/react-query"
import { Link, useLocation } from "@tanstack/react-router"
import { Circle } from "lucide-react"

import { ApiKeySettings } from "./api-key-settings"
import { client } from "@/utils/orpc"
import { cn } from "@/lib/utils"
import { env } from "@ig/env/web"

export default function Header() {
  const location = useLocation()

  const healthQuery = useQuery({
    queryKey: ["health"],
    queryFn: () => client.healthCheck(),
    refetchInterval: 30000,
    retry: 1,
  })

  const pendingQuery = useQuery({
    queryKey: ["generations", "list", { status: "pending" }],
    queryFn: () => client.generations.list({ status: "pending", limit: 1 }),
    refetchInterval: 5000,
  })

  const isConnected = healthQuery.isSuccess
  const pendingCount = pendingQuery.data?.items.length ?? 0

  const navItems = [
    { to: "/generations", label: "generations" },
    { to: "/models", label: "models" },
    { to: "/playground", label: "playground" },
  ] as const

  return (
    <header className="border-b border-border bg-card">
      <div className="flex items-center justify-between px-4 py-2">
        {/* Left: Logo and nav */}
        <div className="flex items-center gap-6">
          <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <span className="text-lg font-semibold tracking-tight">ig-console</span>
          </Link>

          <nav className="flex items-center gap-1">
            {navItems.map(({ to, label }) => {
              const isActive = location.pathname.startsWith(to)
              return (
                <Link
                  key={to}
                  to={to}
                  className={cn(
                    "px-3 py-1.5 text-sm transition-colors",
                    isActive
                      ? "text-foreground bg-muted"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                  )}
                >
                  {label}
                </Link>
              )
            })}
          </nav>
        </div>

        {/* Right: Status indicators */}
        <div className="flex items-center gap-4">
          {/* Pending jobs indicator */}
          {pendingCount > 0 && (
            <Link
              to="/generations"
              search={{ status: "pending" }}
              className="flex items-center gap-1.5 text-xs text-status-pending hover:underline"
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-status-pending opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-status-pending" />
              </span>
              <span>{pendingCount} pending</span>
            </Link>
          )}

          {/* Connection status */}
          <div
            className="flex items-center gap-1.5 text-xs cursor-default"
            title={env.VITE_SERVER_URL}
          >
            <Circle
              className={cn(
                "h-2 w-2 fill-current",
                isConnected ? "text-status-ready" : "text-status-failed",
              )}
            />
            <span className={cn(isConnected ? "text-muted-foreground" : "text-status-failed")}>
              {healthQuery.isLoading ? "..." : isConnected ? "connected" : "disconnected"}
            </span>
          </div>

          {/* API Key settings */}
          <ApiKeySettings />
        </div>
      </div>
    </header>
  )
}
