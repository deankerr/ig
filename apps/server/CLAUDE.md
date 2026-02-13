# Server

Hono + oRPC on Cloudflare Workers.

## Data Persistence Model

**DO (Durable Object)** is the source of truth during a request's lifecycle. It manages active, mutable state — tracking dispatches, webhooks, outputs — and can retain data of any shape. It's queried directly for live request status.

**D1** is a progressive projection of DO state into a queryable schema. Writes happen at each lifecycle transition:

1. Generation row inserted when the request is submitted (no `completedAt`)
2. Artifact rows inserted as each output is confirmed (CDN fetched, R2 stored)
3. Generation row upserted with `completedAt` when all outputs are in, or on failure/timeout

D1 is not used for inflight request management — the DO owns that. If a D1 write fails mid-request, the DO still has the full state and the data is recoverable. The generation table tolerates partial state by design.

**Derived status** — generation state is derived from columns, not stored as an enum:

| `completedAt` | `error` | artifacts vs batch    | State                                   |
| ------------- | ------- | --------------------- | --------------------------------------- |
| null          | null    | any                   | In progress                             |
| set           | null    | batch                 | Succeeded                               |
| set           | null    | < batch               | Partial success                         |
| set           | set     | any                   | Failed (generation-level)               |
| null          | null    | stale (age > timeout) | Application error (derived by consumer) |

The "stale" state can't be reliably recorded in D1 because the failure mode that causes it (Worker crash, D1 write failure) is often the same one that prevents writing the error. Consumers derive it from `createdAt` + the request timeout constant.

## Structure

```
src/
├── index.ts              # Hono app, routes, oRPC handler wiring
├── context.ts            # Context creation (env + headers)
├── orpc.ts               # Procedure definitions (public, apiKey-protected)
├── models.ts             # Runware model catalog search (standalone)
├── routers/              # oRPC routers
│   ├── index.ts          # App router (combines all routers)
│   └── inference.ts      # Inference endpoints (submit, status, model search)
├── routes/               # Hono routes (file serving from R2)
├── inference/            # Inference request system (see its CLAUDE.md)
│   ├── request.ts        # InferenceDO + typed client
│   ├── submit.ts         # Submission orchestration (async/sync paths)
│   ├── dispatch.ts       # Runware API call
│   ├── webhook.ts        # Hono webhook route handler
│   ├── store.ts          # CDN fetch → R2 upload
│   ├── persist.ts        # D1 progressive projection (all lifecycle writes)
│   ├── result.ts         # Result types + factories
│   ├── schema.ts         # Runware API schemas
│   ├── config.ts         # REQUEST_TIMEOUT_MS constant
│   └── index.ts          # Public API
├── services/             # Internal functions — (ctx, args) pattern
│   └── auto-aspect-ratio.ts  # AI-powered aspect ratio selection
└── utils/
    ├── result.ts         # Result<T, E> type
    ├── error.ts          # getErrorMessage, serializeError, error handlers
    └── slug.ts           # UUIDv7 slug utilities (unused, kept for later)
```

## Result Type

Fallible operations use `Result<T, E>` from `utils/result.ts`:

```typescript
type Result<T, E = unknown> = { ok: true; value: T } | { ok: false; message: string; error?: E }
```

```typescript
// Returning
return { ok: true, value: { data, contentType } }
return { ok: false, message: 'HTTP 404' }
return { ok: false, message: 'Decode failed', error: { code: 'DECODE_FAILED' } }

// Consuming
const result = await doThing()
if (!result.ok) {
  console.log(result.message, result.error)
  return
}
const { data } = result.value
```

## Error Utilities

```typescript
import { getErrorMessage, serializeError } from './utils/error'

getErrorMessage(error) // error.message or String(error)
serializeError(error) // { name, message, cause?, ...custom } — preserves cause chain
```

`handleOrpcError` and `handleHonoError` are the framework error handlers — they serialize, log, and format the response.
