# Inference

Queue-based image generation via Runware's API. Submit a request, receive results via webhook, store artifacts in R2, project metadata to D1 progressively.

All exported functions follow the `(ctx: Context, args)` pattern.

## Event Flow

### Async path

```
submitRequest()
  ├─ generate ID
  ├─ DO.init() — initialize state
  ├─ persist.insertGeneration() — D1 row appears (completedAt: null)
  └─ waitUntil: backgroundDispatch()
       ├─ auto aspect ratio
       ├─ dispatch() → Runware API
       └─ DO.setDispatchResult()
            └─ on error: persist.failGeneration() — D1 row updated

webhook POST
  ├─ DO.recordWebhook() — validate, extract items
  └─ waitUntil: for each item:
       ├─ store.storeArtifact() — CDN → R2
       ├─ persist.insertArtifact() — D1 artifact row appears
       └─ DO.confirmOutputs()
            └─ if complete: persist.completeGeneration() — D1 row updated

DO alarm (timeout)
  ├─ DO marks error + completedAt
  └─ persist.failGeneration() — D1 row updated
```

### Sync path

Same progressive writes but sequential in one request:

1. `insertGeneration()` → 2. dispatch → 3. for each: `storeArtifact()` + `insertArtifact()` → 4. `completeGeneration()` + DO state

## Files

| File          | Role                                                                                        |
| ------------- | ------------------------------------------------------------------------------------------- |
| `request.ts`  | Durable Object (InferenceDO) + typed client. Coordination-only state register. No I/O.      |
| `submit.ts`   | Submission orchestration — async/sync paths, aspect ratio, calls dispatch + persist.        |
| `dispatch.ts` | Runware API call — builds request, sends it, parses response.                               |
| `webhook.ts`  | Hono route handler — receives webhook, delegates to DO, processes artifacts in `waitUntil`. |
| `store.ts`    | CDN fetch → R2 upload → artifact output result.                                             |
| `persist.ts`  | All D1 write functions — fire-and-forget at each lifecycle transition.                      |
| `result.ts`   | Result types + factories. Request-level errors (`RequestError`) and output construction.    |
| `schema.ts`   | Zod schemas matching Runware's API shapes exactly.                                          |
| `config.ts`   | `REQUEST_TIMEOUT_MS` constant — imported by request.ts, exported for client consumption.    |
| `index.ts`    | Re-exports `submitRequest`, `webhook`, `REQUEST_TIMEOUT_MS`.                                |

## Architecture Notes

### DO is coordination-only

The DO stores state and validates webhooks but performs zero I/O (except the alarm handler which calls `persist.failGeneration`). All heavy work (CDN fetches, R2 uploads, D1 writes) happens at the Worker level in `waitUntil`. This keeps the DO fast and avoids blocking Runware's webhook response.

### Progressive D1 projection

D1 writes happen at each lifecycle transition, not just at completion:

- `insertGeneration` — on submission (no completedAt)
- `insertArtifact` — after each artifact is stored to R2
- `completeGeneration` — when all outputs confirmed
- `failGeneration` — on timeout or dispatch failure (uses upsert)

All persist functions are fire-and-forget. D1 failures are logged but don't break request flow.

### Two-level error system

**Request-level errors** (`meta.error: RequestError`) represent failures of the request as a whole — dispatch rejected, timeout.

**Output-level errors** (`Output` with `type: 'error'`) represent individual output failures — a single CDN fetch failed, an R2 upload failed, webhook payload didn't validate.

A request can have a mix of successful and errored outputs. The two levels are independent.

### Webhook returns 200 immediately

The webhook handler always returns 200 to Runware before processing starts. Background work runs in `waitUntil`. If we returned errors, Runware would retry and we'd get duplicate processing.
