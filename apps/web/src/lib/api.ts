import type { AppRouterClient } from '@ig/server/src/routers'
import { createORPCClient } from '@orpc/client'
import { RPCLink } from '@orpc/client/fetch'
import { createTanstackQueryUtils } from '@orpc/tanstack-query'
import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import * as storage from '@/lib/storage'
import { serverUrl } from '@/lib/utils'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
    },
  },
  queryCache: new QueryCache({
    onError: (error, query) => {
      console.error('[query error]', query.queryKey, error)
      // Only toast on background refetch failures — initial load errors are visible in the UI
      if (query.state.data !== undefined) {
        toast.error(`Error: ${error.message}`)
      }
    },
  }),
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      console.error('[mutation error]', mutation.options.mutationKey, error)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries()
    },
  }),
})

export const link = new RPCLink({
  url: new URL('/rpc', serverUrl).href,
  headers() {
    const apiKey = storage.getApiKey()
    return apiKey ? { 'x-api-key': apiKey } : {}
  },
  fetch(url, options) {
    return fetch(url, {
      ...options,
    })
  },
})

const client: AppRouterClient = createORPCClient(link)

export const orpc = createTanstackQueryUtils(client)
