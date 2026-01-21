import type { AppRouterClient } from "@ig/api/routers/index"

import { env } from "@ig/env/web"
import { createORPCClient } from "@orpc/client"
import { RPCLink } from "@orpc/client/fetch"
import { createTanstackQueryUtils } from "@orpc/tanstack-query"
import { QueryCache, QueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      toast.error(`Error: ${error.message}`, {
        action: {
          label: "retry",
          onClick: query.invalidate,
        },
      })
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
      credentials: "include",
    })
  },
})

export const client: AppRouterClient = createORPCClient(link)

export const orpc = createTanstackQueryUtils(client)
