import { OpenAPIHandler } from '@orpc/openapi/fetch'
import { OpenAPIReferencePlugin } from '@orpc/openapi/plugins'
import { onError } from '@orpc/server'
import { RPCHandler } from '@orpc/server/fetch'
import { ZodToJsonSchemaConverter } from '@orpc/zod/zod4'
import { Hono } from 'hono'
import { cors } from 'hono/cors'

import type { Context } from './context'
import { webhook as runwareWebhook } from './providers/runware'
import { appRouter } from './routers'
import { fileRoutes } from './routes/file'
import { handleOrpcError, handleHonoError } from './utils/error'

const app = new Hono<{ Bindings: Env }>()

// Global error handler for webhook routes and any unhandled errors
app.onError((error, c) => {
  const { status, body } = handleHonoError(error)
  return c.json(body, status)
})

app.use(
  '/*',
  cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
  }),
)

app.route('/webhooks/runware', runwareWebhook)
app.route('/', fileRoutes)

export const apiHandler = new OpenAPIHandler(appRouter, {
  plugins: [
    new OpenAPIReferencePlugin({
      schemaConverters: [new ZodToJsonSchemaConverter()],
      specGenerateOptions: {
        components: {
          securitySchemes: {
            ApiKeyAuth: {
              type: 'apiKey',
              in: 'header',
              name: 'x-api-key',
            },
          },
        },
        security: [{ ApiKeyAuth: [] }],
      },
    }),
  ],
  interceptors: [onError(handleOrpcError)],
})

export const rpcHandler = new RPCHandler(appRouter, {
  interceptors: [onError(handleOrpcError)],
})

app.use('/*', async (c, next) => {
  const context: Context = { env: c.env, headers: c.req.raw.headers }

  const rpcResult = await rpcHandler.handle(c.req.raw, {
    prefix: '/rpc',
    context: context,
  })

  if (rpcResult.matched) {
    return c.newResponse(rpcResult.response.body, rpcResult.response)
  }

  const apiResult = await apiHandler.handle(c.req.raw, {
    prefix: '/api',
    context: context,
  })

  if (apiResult.matched) {
    return c.newResponse(apiResult.response.body, apiResult.response)
  }

  await next()
})

app.get('/', (c) => {
  return c.text('HELLO')
})

app.get('/favicon.ico', (c) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" fill="#171717"/>
  <text x="16" y="22" font-family="ui-monospace, monospace" font-size="14" font-weight="600" fill="#fb923c" text-anchor="middle">ig</text>
</svg>`
  return c.body(svg, 200, {
    'Content-Type': 'image/svg+xml',
    'Cache-Control': 'public, max-age=31536000',
  })
})

export { GenerationDO } from './providers/runware/generationDo'

export default {
  fetch: app.fetch,
}
