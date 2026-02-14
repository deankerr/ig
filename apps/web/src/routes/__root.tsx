import type { QueryClient } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { HeadContent, Outlet, createRootRouteWithContext } from '@tanstack/react-router'

import { RouteError } from '@/components/route-error'
import { Toaster } from '@/components/ui/sonner'

import '../index.css'

export interface RouterAppContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<RouterAppContext>()({
  component: RootComponent,
  errorComponent: RouteError,
  head: () => ({
    meta: [
      {
        title: import.meta.env.PROD
          ? 'ig console'
          : `[${import.meta.env.MODE.toUpperCase().slice(0, 3)}] ig console`,
      },
      {
        name: 'description',
        content: 'Developer console for ig generative AI infrastructure',
      },
    ],
    links: [
      {
        rel: 'icon',
        href: '/favicon.ico',
      },
    ],
  }),
})

function RootComponent() {
  return (
    <>
      <HeadContent />
      <Outlet />

      <Toaster
        position="bottom-right"
        toastOptions={{
          className: 'font-mono text-sm border-border bg-card',
        }}
      />
      {/* <TanStackRouterDevtools position="bottom-left" /> */}
      <ReactQueryDevtools position="bottom" buttonPosition="bottom-right" />
    </>
  )
}
