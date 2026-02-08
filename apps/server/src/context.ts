import type { Context as HonoContext } from 'hono'

import type { Services } from './services'

export type CreateContextOptions = {
  context: HonoContext
  services: Services
}

export async function createContext({ context, services }: CreateContextOptions) {
  return {
    env: context.env as Env,
    services,
    headers: context.req.raw.headers,
  }
}

export type Context = Awaited<ReturnType<typeof createContext>>
