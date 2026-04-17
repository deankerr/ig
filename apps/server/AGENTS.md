# Server

Hono + oRPC on Cloudflare Workers.

## Data Persistence Model

**DO (Durable Object)** is the source of truth during a request's lifecycle. It manages active, mutable state — tracking dispatches, webhooks, outputs — and can retain data of any shape. It's queried directly for live request status.

**D1** is a progressive projection of DO state into a queryable schema. Writes happen at each lifecycle transition.

## Result Type

Fallible operations use `Result<T, E>` from `utils/result.ts`:

```typescript
type Result<T, E = unknown> = { ok: true; value: T } | { ok: false; message: string; error?: E }
```

## Error Utilities

```typescript
import { getErrorMessage, serializeError } from './utils/error'

getErrorMessage(error) // error.message or String(error)
serializeError(error) // { name, message, cause?, ...custom } — preserves cause chain
```

`handleOrpcError` and `handleHonoError` are the framework error handlers — they serialize, log, and format the response.
