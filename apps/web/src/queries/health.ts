import { orpc } from "@/lib/orpc"

export function healthQueryOptions() {
  return orpc.healthCheck.queryOptions({
    refetchInterval: 30000,
    retry: 1,
  })
}
