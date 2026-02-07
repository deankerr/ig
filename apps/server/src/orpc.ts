import { ORPCError, os } from '@orpc/server'

import type { Context } from './context'

export const o = os.$context<Context>()

export const publicProcedure = o

const requireApiKey = o.middleware(async ({ context, next }) => {
  const apiKey = context.headers.get('x-api-key')
  if (!apiKey || apiKey !== context.env.API_KEY) {
    throw new ORPCError('UNAUTHORIZED', { message: 'Invalid or missing API key' })
  }
  return next({})
})

export const apiKeyProcedure = publicProcedure.use(requireApiKey)
