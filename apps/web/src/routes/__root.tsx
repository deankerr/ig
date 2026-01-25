import type { QueryClient } from "@tanstack/react-query"

import { ReactQueryDevtools } from "@tanstack/react-query-devtools"
import { HeadContent, Outlet, createRootRouteWithContext } from "@tanstack/react-router"
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools"

import { RouteError } from "@/components/devtools/route-error"
import Header from "@/components/header"
import { Toaster } from "@/components/ui/sonner"
import { orpc } from "@/utils/orpc"

import "../index.css"

export interface RouterAppContext {
  orpc: typeof orpc
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<RouterAppContext>()({
  component: RootComponent,
  errorComponent: RouteError,
  head: () => ({
    meta: [
      {
        title: "ig-console",
      },
      {
        name: "description",
        content: "Developer console for ig generative AI infrastructure",
      },
    ],
    links: [
      {
        rel: "icon",
        href: "/favicon.ico",
      },
    ],
  }),
})

function RootComponent() {
  return (
    <>
      <HeadContent />
      <div className="flex h-svh flex-col overflow-hidden bg-background text-foreground">
        <Header />
        <main className="flex-1 overflow-hidden">
          <Outlet />
        </main>
      </div>
      <Toaster
        position="bottom-right"
        toastOptions={{
          className: "font-mono text-sm border-border bg-card",
        }}
      />
      <TanStackRouterDevtools position="bottom-left" />
      <ReactQueryDevtools position="bottom" buttonPosition="bottom-right" />
    </>
  )
}
