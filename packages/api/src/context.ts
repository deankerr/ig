import type { Context as HonoContext } from "hono"

import { env } from "@ig/env/server"

export type CreateContextOptions = {
  context: HonoContext
}

export async function createContext({ context }: CreateContextOptions) {
  return {
    env,
    headers: context.req.raw.headers,
  }
}

export type Context = Awaited<ReturnType<typeof createContext>>
