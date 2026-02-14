import { ORPCError, os } from '@orpc/server'

import type { Context } from './context'

const requireApiKey = os.$context<Context>().middleware(async ({ context, next }) => {
  const apiKey = context.headers.get('x-api-key')
  if (!apiKey || apiKey !== context.env.API_KEY) {
    throw new ORPCError('UNAUTHORIZED', { message: 'Invalid or missing API key' })
  }
  return next({})
})

export const procedure = os.$context<Context>().use(requireApiKey)
