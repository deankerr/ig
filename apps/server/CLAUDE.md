# Server Package

## Structure

```
src/
├── index.ts              # Hono app, routes, middleware
├── context.ts            # oRPC context creation
├── orpc.ts               # Procedure definitions (public, apiKey-protected)
├── routers/              # oRPC routers (generations, runware)
├── routes/               # Hono routes (file serving)
├── services/             # Business logic (generations, auto-aspect-ratio)
├── providers/            # External provider integrations
│   ├── fal/              # fal.ai (create, webhook, resolve, verify)
│   ├── runware/          # Runware (create, webhook, resolve, schemas)
│   ├── types.ts          # ProviderResult, ResolvedOutput
│   └── utils.ts          # fetchUrl, decodeBase64, parseDataURI
└── utils/
    ├── result.ts         # Result<T, E> type
    └── error.ts          # getErrorMessage, serializeError
```

## Result Type

All fallible operations use `Result<T, E>` from `utils/result.ts`:

```typescript
type Result<T, E = unknown> = { ok: true; value: T } | { ok: false; message: string; error?: E }
```

### Returning Results

```typescript
// Success - wrap data in value
return { ok: true, value: { data, contentType } }

// Failure - message is required, error context is optional
return { ok: false, message: "HTTP 404" }
return { ok: false, message: "Decode failed", error: { code: "DECODE_FAILED" } }
```

### Consuming Results

```typescript
const result = await fetchUrl(url)

if (!result.ok) {
  // result.message - human readable
  // result.error   - optional context (type depends on E)
  console.log(result.message, result.error)
  return
}

// result.value - the success data (type T)
const { data, contentType } = result.value
```

### Domain-Specific Results

Provider types in `providers/types.ts` are specialized Results:

```typescript
// ResolvedOutput - single output from a provider
type ResolvedOutput = Result<
  { data: ArrayBuffer | Uint8Array; contentType: string; metadata?: Record<string, unknown> },
  { code: string } // code stored in DB errorCode column
>

// ProviderResult - overall webhook resolution
type ProviderResult = Result<
  { outputs: ResolvedOutput[]; requestId?: string; metadata?: Record<string, unknown> },
  { code: string }
>
```

### Storing Errors

When storing a Result in the database (e.g., providerMetadata):

```typescript
// Success - store value directly with ok marker
providerMetadata = { autoAspectRatio: { ok: true, ...result.value } }

// Failure - include message and error context
providerMetadata = { autoAspectRatio: { ok: false, message, ...error } }
```

For serialized errors that might have unknown shape, isolate in `cause`:

```typescript
error: { cause: serializeError(error), model: MODEL_ID }
```

This prevents field collisions when spreading.

## Error Utilities

```typescript
import { getErrorMessage, serializeError } from "./utils/error"

// Extract message from unknown error
const message = getErrorMessage(error) // error instanceof Error ? error.message : String(error)

// Serialize error for storage (preserves cause chain, custom properties)
const serialized = serializeError(error) // { name, message, cause?, ...customProps }
```
