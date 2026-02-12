import { createORPCClient } from '@orpc/client'
import { RPCLink } from '@orpc/client/fetch'
import { createTanstackQueryUtils } from '@orpc/tanstack-query'
import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'
import type { AppRouterClient } from 'server/src/routers'
import { toast } from 'sonner'

import * as storage from '@/lib/storage'
import { serverUrl } from '@/lib/utils'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Keep cached data for 24 hours (for localStorage persistence)
      gcTime: 1000 * 60 * 60 * 24,
      // Consider data stale after 5 minutes
      staleTime: 1000 * 60 * 5,
    },
  },
  queryCache: new QueryCache({
    onError: (error, query) => {
      console.error('[query error]', query.queryKey, error)
      toast.error(`Error: ${error.message}`)
    },
  }),
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      console.error('[mutation error]', mutation.options.mutationKey, error)
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
