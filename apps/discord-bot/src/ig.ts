import type { AppRouterClient } from '@ig/server/src/routers'
import { createORPCClient } from '@orpc/client'
import { RPCLink } from '@orpc/client/fetch'
import z from 'zod'

type CreateGenerationProcedure = AppRouterClient['generations']['create']
type GetGenerationProcedure = AppRouterClient['generations']['get']
type GetArtifactProcedure = AppRouterClient['artifacts']['get']
type SearchModelsProcedure = AppRouterClient['models']['search']
type CreateGenerationResult = Awaited<ReturnType<CreateGenerationProcedure>>

export type IgCreateGenerationInput = Parameters<CreateGenerationProcedure>[0] & { sync: true }
export type IgSyncGeneration = Extract<
  CreateGenerationResult,
  { generation: unknown; artifacts: unknown[] }
>
export type IgGeneration = Awaited<ReturnType<GetGenerationProcedure>>
export type IgArtifactLookup = Awaited<ReturnType<GetArtifactProcedure>>
export type IgModelSearchResult = Awaited<ReturnType<SearchModelsProcedure>>

function assertSyncGenerationResult(result: CreateGenerationResult): IgSyncGeneration {
  if ('generation' in result && 'artifacts' in result) {
    return result
  }

  throw new Error('Expected sync generation result from ig')
}

export function createIgClient(args: { baseUrl: string; apiKey: string }) {
  const link = new RPCLink({
    url: new URL('/rpc', args.baseUrl).href,
    headers() {
      return { 'x-api-key': args.apiKey }
    },
    fetch(url, options) {
      return fetch(url, {
        ...options,
      })
    },
  })

  const client: AppRouterClient = createORPCClient(link)

  return {
    async createGeneration(input: IgCreateGenerationInput): Promise<IgSyncGeneration> {
      const result = await client.generations.create(input)
      return assertSyncGenerationResult(result)
    },

    getGeneration(id: string) {
      return client.generations.get({ id })
    },

    getArtifact(id: string) {
      return client.artifacts.get({ id })
    },

    artifactFileUrl(id: string) {
      return new URL(`/artifacts/${id}/file?f=auto`, args.baseUrl).toString()
    },

    searchModels(search: string) {
      return client.models.search({ search, limit: 25 })
    },

    parseDimensionValue(value?: string) {
      return z.enum(['auto', 'landscape', 'portrait', 'square']).catch('auto').parse(value)
    },
  }
}

export type IgClient = ReturnType<typeof createIgClient>
