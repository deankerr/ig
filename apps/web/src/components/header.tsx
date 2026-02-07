import { useQuery } from "@tanstack/react-query"
import { Link, useLocation } from "@tanstack/react-router"
import { CircleIcon } from "lucide-react"
import { ApiKeySettings } from "./api-key-settings"
import { PulsingDot } from "./pulsing-dot"
import { healthQueryOptions } from "@/queries/health"
import { pendingCountQueryOptions } from "@/queries/generations"
import { serverUrl } from "@/lib/server-url"
import { cn } from "@/lib/utils"

export default function Header() {
  const location = useLocation()

  const healthQuery = useQuery(healthQueryOptions())
  const pendingQuery = useQuery(pendingCountQueryOptions())

  const isConnected = healthQuery.isSuccess
  const pendingCount = pendingQuery.data?.items.length ?? 0

  const navItems = [
    { to: "/generations", label: "generations" },
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
              <PulsingDot />
              <span>{pendingCount} pending</span>
            </Link>
          )}

          {/* Connection status */}
          <a
            href={new URL("/api", serverUrl).href}
            target="_blank"
            rel="noopener"
            className="flex items-center gap-1.5 text-xs"
          >
            <CircleIcon
              className={cn(
                "size-2 fill-current",
                isConnected ? "text-status-ready" : "text-status-failed",
              )}
            />
            <span className={cn(isConnected ? "text-muted-foreground" : "text-status-failed")}>
              {serverUrl.hostname}
            </span>
          </a>

          {/* API Key settings */}
          <ApiKeySettings />
        </div>
      </div>
    </header>
  )
}
