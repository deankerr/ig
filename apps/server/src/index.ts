import { createContext } from "@ig/api/context"
import { appRouter } from "@ig/api/routers/index"
import {
  processModelSyncMessage,
  startModelSync,
  type ModelSyncMessage,
} from "@ig/api/services/model-sync"
import { OpenAPIHandler } from "@orpc/openapi/fetch"
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins"
import { onError } from "@orpc/server"
import { RPCHandler } from "@orpc/server/fetch"
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4"
import { Hono } from "hono"
import { cors } from "hono/cors"
import { logger } from "hono/logger"
import { falWebhook } from "./fal"
import { fileRoutes } from "./routes/file"

const app = new Hono()

app.use(logger())
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
  return c.text("OK")
})

export default {
  fetch: app.fetch,

  // Queue consumer: process model pricing fetch batches
  async queue(batch: MessageBatch<ModelSyncMessage>, env: Env) {
    for (const message of batch.messages) {
      try {
        await processModelSyncMessage({
          message: message.body,
          falKey: env.FAL_KEY,
        })
        message.ack()
      } catch (error) {
        console.log("queue_message_failed", {
          type: message.body.type,
          error: error instanceof Error ? error.message : String(error),
        })
        message.retry()
      }
    }
  },

  // Scheduled handler: daily model sync at 4 AM UTC
  async scheduled(controller: ScheduledController, env: Env) {
    console.log("scheduled_model_sync_started", { cron: controller.cron })

    try {
      const result = await startModelSync({
        falKey: env.FAL_KEY,
        queue: env.MODEL_SYNC_QUEUE,
      })

      console.log("scheduled_model_sync_complete", result)
    } catch (error) {
      console.log("scheduled_model_sync_failed", {
        error: error instanceof Error ? error.message : String(error),
      })
    }
  },
}
