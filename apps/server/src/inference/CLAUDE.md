# Inference

Queue-based image generation via Runware's API. Submit a request, receive results via webhook, store artifacts in R2, project metadata to D1.

All exported functions follow the `(ctx: Context, args)` pattern.

## Event Flow

```
Client → router → submit.ts → Runware API
                                     ↓
                             webhook.ts (POST)
                                     ↓
                           request.ts (recordWebhook)
                                     ↓
                             webhook.ts (waitUntil)
                           fetch CDN → store R2 → write D1
                                     ↓
                           request.ts (confirmOutputs)
```

## Files

| File         | Role                                                                                                                                                                                       |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `request.ts` | Durable Object (InferenceDO) + typed client. Coordination-only state register — tracks webhooks received, outputs confirmed, completion. Does **no I/O**. Uses sync KV (`ctx.storage.kv`). |
| `submit.ts`  | Submit a request: dispatch to Runware API, initialize DO with result. Returns the request ID.                                                                                              |
| `webhook.ts` | Hono route + background processing. Receives Runware's webhook, delegates validation to the DO, then runs CDN fetch → R2 upload → D1 write in `waitUntil`.                                 |
| `result.ts`  | All result types and factories. Request-level errors (`RequestError`) and output types/factories (`output.success`, `output.fetchError`, etc).                                             |
| `schema.ts`  | Zod schemas matching Runware's API shapes exactly (no renaming). Input validation + webhook payload parsing.                                                                               |
| `index.ts`   | Re-exports `submitRequest` and `webhook`.                                                                                                                                                  |

## Architecture Notes

### DO is coordination-only

The DO stores state and validates webhooks but performs zero I/O. All heavy work (CDN fetches, R2 uploads, D1 writes) happens at the Worker level in `waitUntil`. This keeps the DO fast, avoids blocking Runware's webhook response, and means DO methods can be synchronous KV reads/writes.

### DO + client colocated in request.ts

The DO class (InferenceDO) and its typed RPC client live in the same file. CF's `Rpc.Provider` collapses sync DO methods to `never`, so the client interface is defined separately. `getRequest(ctx, id)` returns a typed client for a specific request's DO instance.

### Two-level error system

**Request-level errors** (`meta.error: RequestError`) represent failures of the request as a whole — dispatch rejected, timeout, D1 projection failure. Stored on the request metadata.

**Output-level errors** (`Output` with `type: 'error'`) represent individual output failures — a single CDN fetch failed, an R2 upload failed, webhook payload didn't validate. These sit alongside successful outputs in the `outputs` array.

A request can have a mix of successful and errored outputs. The two levels are independent.

### D1 projection failure

When all outputs are confirmed but the D1 write fails, the request's outputs exist in R2 and the DO has the complete state, but D1 has no record. This is a **projection failure** — the read model is broken, not the request itself.

The error is recorded as `meta.error` with code `projection_failed`. The DO state (queryable via `getState`) still contains all successful outputs with their R2 keys, so the data is recoverable.

### Webhook returns 200 immediately

The webhook handler always returns 200 to Runware before processing starts. Background work runs in `waitUntil`. If we returned errors, Runware would retry and we'd get duplicate processing.

### Deferred renames

The DO class is `InferenceDO` internally but exported as `GenerationDO` from the worker entrypoint to match the existing Cloudflare binding. Binding names (`GENERATION_DO`, `GENERATIONS_BUCKET`) and D1 table names (`runwareGenerations`, `runwareArtifacts`) will be renamed in a future migration.
