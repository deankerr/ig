import { orpc } from '@/lib/orpc'

export function listArtifactsOptions() {
  return orpc.browse.listArtifacts.infiniteOptions({
    input: (cursor) => ({ cursor, limit: 20 }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  })
}

export function getArtifactOptions(id: string) {
  return orpc.browse.getArtifact.queryOptions({ input: { id } })
}
