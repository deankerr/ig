import type { AppRouterClient } from "server/src/routers"

import { env } from "@ig/env/web"
import { createORPCClient } from "@orpc/client"
import { RPCLink } from "@orpc/client/fetch"
import { createTanstackQueryUtils } from "@orpc/tanstack-query"
import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

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
      console.error("[query error]", query.queryKey, error)
      toast.error(`Error: ${error.message}`)
    },
  }),
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      console.error("[mutation error]", mutation.options.mutationKey, error)
    },
  }),
})

const API_KEY_STORAGE_KEY = "ig-api-key"

export function getApiKey(): string | null {
  return localStorage.getItem(API_KEY_STORAGE_KEY)
}

export function setApiKey(key: string): void {
  localStorage.setItem(API_KEY_STORAGE_KEY, key)
}

export function clearApiKey(): void {
  localStorage.removeItem(API_KEY_STORAGE_KEY)
}

export const link = new RPCLink({
  url: `${env.VITE_SERVER_URL}/rpc`,
  headers() {
    const apiKey = getApiKey()
    return apiKey ? { "x-api-key": apiKey } : {}
  },
  fetch(url, options) {
    return fetch(url, {
      ...options,
    })
  },
})

const client: AppRouterClient = createORPCClient(link)

export const orpc = createTanstackQueryUtils(client)
