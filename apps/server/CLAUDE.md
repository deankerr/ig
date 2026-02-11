# Server

Hono + oRPC on Cloudflare Workers.

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
│   ├── submit.ts         # Submit request to Runware API
│   ├── webhook.ts        # Webhook handler + artifact processing
│   ├── result.ts         # Result types + factories (request errors + output construction)
│   ├── schema.ts         # Runware API schemas
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
