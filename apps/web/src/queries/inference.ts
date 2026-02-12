import { orpc } from '@/lib/orpc'

export function createImageMutation() {
  return orpc.inference.createImage.mutationOptions()
}

export function statusQueryOptions(id: string) {
  return orpc.inference.getStatus.queryOptions({
    input: { id },
    refetchInterval: (query) => {
      const data = query.state.data
      if (data?.completedAt) return false
      return 3000
    },
  })
}
