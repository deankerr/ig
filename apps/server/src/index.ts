import { createContext } from "@ig/api/context"
import { appRouter } from "@ig/api/routers/index"
import { OpenAPIHandler } from "@orpc/openapi/fetch"
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins"
import { onError } from "@orpc/server"
import { RPCHandler } from "@orpc/server/fetch"
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4"
import { Hono } from "hono"
import { cors } from "hono/cors"
import { falWebhook } from "./fal"
import { fileRoutes } from "./routes/file"

// Export workflow class for Cloudflare
export { ModelSyncWorkflow } from "./fal/model-sync"

const app = new Hono()

app.use(
  "/*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "x-api-key"],
  }),
)

app.route("/webhooks/fal", falWebhook)
app.route("/", fileRoutes)

export const apiHandler = new OpenAPIHandler(appRouter, {
  plugins: [
    new OpenAPIReferencePlugin({
      schemaConverters: [new ZodToJsonSchemaConverter()],
      specGenerateOptions: {
        components: {
          securitySchemes: {
            ApiKeyAuth: {
              type: "apiKey",
              in: "header",
              name: "x-api-key",
            },
          },
        },
        security: [{ ApiKeyAuth: [] }],
      },
    }),
  ],
  interceptors: [
    onError((error) => {
      console.error(error)
    }),
  ],
})

export const rpcHandler = new RPCHandler(appRouter, {
  interceptors: [
    onError((error) => {
      console.error(error)
    }),
  ],
})

app.use("/*", async (c, next) => {
  const context = await createContext({ context: c })

  const rpcResult = await rpcHandler.handle(c.req.raw, {
    prefix: "/rpc",
    context: context,
  })

  if (rpcResult.matched) {
    return c.newResponse(rpcResult.response.body, rpcResult.response)
  }

  const apiResult = await apiHandler.handle(c.req.raw, {
    prefix: "/api",
    context: context,
  })

  if (apiResult.matched) {
    return c.newResponse(apiResult.response.body, apiResult.response)
  }

  await next()
})

app.get("/", (c) => {
  return c.text("HELLO")
})

app.get("/favicon.ico", (c) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" fill="#171717"/>
  <text x="16" y="22" font-family="ui-monospace, monospace" font-size="14" font-weight="600" fill="#fb923c" text-anchor="middle">ig</text>
</svg>`
  return c.body(svg, 200, {
    "Content-Type": "image/svg+xml",
    "Cache-Control": "public, max-age=31536000",
  })
})

export default {
  fetch: app.fetch,

  // Scheduled handler: daily model sync at 4 AM UTC
  async scheduled(controller: ScheduledController, env: Env) {
    console.log("scheduled_model_sync_started", { cron: controller.cron })

    const workflow = env.MODEL_SYNC_WORKFLOW
    const instanceId = "model-sync"

    // Check if any sync is already running
    for (const id of ["model-sync", "model-sync-all"]) {
      try {
        const instance = await workflow.get(id)
        const { status } = await instance.status()
        if (status === "running" || status === "queued" || status === "waiting") {
          console.log("scheduled_model_sync_skipped", { reason: "sync in progress", activeId: id })
          return
        }
      } catch {
        // Instance doesn't exist
      }
    }

    // Create or restart the workflow
    try {
      await workflow.create({ id: instanceId, params: {} })
      console.log("scheduled_model_sync_workflow_created", { instanceId })
    } catch {
      // Instance already exists in completed/errored state, restart it
      try {
        const instance = await workflow.get(instanceId)
        await instance.restart()
        console.log("scheduled_model_sync_workflow_restarted", { instanceId })
      } catch (error) {
        console.log("scheduled_model_sync_failed", {
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }
  },
}
