import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import ReactDOM from 'react-dom/client'

import { BenchProvider } from './components/bench-provider'
import Loader from './components/loader'
import { JsonSheetProvider } from './components/shared/json-sheet'
import { TooltipProvider } from './components/ui/tooltip'
import { queryClient } from './lib/api'
import { routeTree } from './routeTree.gen'

const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  defaultPendingComponent: () => <Loader />,
  context: { queryClient },
  Wrap: function WrapComponent({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <JsonSheetProvider>
            <BenchProvider>{children}</BenchProvider>
          </JsonSheetProvider>
        </TooltipProvider>
      </QueryClientProvider>
    )
  },
  scrollRestoration: true,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

const rootElement = document.getElementById('app')

if (!rootElement) {
  throw new Error('Root element not found')
}

if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement)
  root.render(<RouterProvider router={router} />)
}
