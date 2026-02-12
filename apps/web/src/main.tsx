import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import ReactDOM from 'react-dom/client'

import { BenchProvider } from './components/bench-provider'
import Loader from './components/loader'
import { JsonSheetProvider } from './components/shared/json-sheet'
import { TooltipProvider } from './components/ui/tooltip'
import { queryClient } from './lib/orpc'
import { routeTree } from './routeTree.gen'

const persister = createAsyncStoragePersister({
  storage: window.localStorage,
  key: 'ig-query-cache',
})

const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  defaultPendingComponent: () => <Loader />,
  context: { queryClient },
  Wrap: function WrapComponent({ children }: { children: React.ReactNode }) {
    return (
      <PersistQueryClientProvider client={queryClient} persistOptions={{ persister }}>
        <TooltipProvider>
          <JsonSheetProvider>
            <BenchProvider>{children}</BenchProvider>
          </JsonSheetProvider>
        </TooltipProvider>
      </PersistQueryClientProvider>
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
