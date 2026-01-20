import { createContext } from "@ig/api/context";
import { appRouter } from "@ig/api/routers/index";
import { auth } from "@ig/auth";
import { db } from "@ig/db";
import { generations } from "@ig/db/schema";
import { env } from "@ig/env/server";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { onError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

import { falWebhook } from "./webhooks/fal";

const app = new Hono();

app.use(logger());
app.use(
  "/*",
  cors({
    origin: env.CORS_ORIGIN,
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  }),
);

app.route("/webhooks/fal", falWebhook);

app.get("/generations/:id/file", async (c) => {
  const id = c.req.param("id");

  const result = await db.select().from(generations).where(eq(generations.id, id)).limit(1);
  const generation = result[0];

  if (!generation) {
    return c.json({ error: "Generation not found" }, 404);
  }

  if (generation.status !== "ready") {
    return c.json({ error: "Generation not ready", status: generation.status }, 400);
  }

  const r2Key = `generations/${id}`;
  const object = await env.GENERATIONS_BUCKET.get(r2Key);

  if (!object) {
    return c.json({ error: "File not found in storage" }, 404);
  }

  return new Response(object.body, {
    headers: {
      "Content-Type": generation.contentType ?? "application/octet-stream",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
});

app.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw));

export const apiHandler = new OpenAPIHandler(appRouter, {
  plugins: [
    new OpenAPIReferencePlugin({
      schemaConverters: [new ZodToJsonSchemaConverter()],
    }),
  ],
  interceptors: [
    onError((error) => {
      console.error(error);
    }),
  ],
});

export const rpcHandler = new RPCHandler(appRouter, {
  interceptors: [
    onError((error) => {
      console.error(error);
    }),
  ],
});

app.use("/*", async (c, next) => {
  const context = await createContext({ context: c });

  const rpcResult = await rpcHandler.handle(c.req.raw, {
    prefix: "/rpc",
    context: context,
  });

  if (rpcResult.matched) {
    return c.newResponse(rpcResult.response.body, rpcResult.response);
  }

  const apiResult = await apiHandler.handle(c.req.raw, {
    prefix: "/api",
    context: context,
  });

  if (apiResult.matched) {
    return c.newResponse(apiResult.response.body, apiResult.response);
  }

  await next();
});

app.get("/", (c) => {
  return c.text("OK");
});

export default app;
