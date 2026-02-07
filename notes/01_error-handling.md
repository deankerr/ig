# Error Handling Strategy

## The Problem

We're frequently in the dark when errors occur. The current error logging shows:

```
Error: Failed query: insert into "generations" ...
params: ...
```

But the actual D1/SQLite error reason is buried in `.cause` and not surfaced. We only discovered a UNIQUE constraint violation by manually querying the database.

### Specific Issues

1. **D1 errors are opaque** - Drizzle wraps D1 errors, and the root cause (SQLite error code, constraint name) isn't logged
2. **No request context** - When an error occurs, we can't trace it back to a specific request
3. **Provider errors unknown** - We don't know what fal.ai or Runware return on failure
4. **Inconsistent handling** - Some errors go through oRPC, some through Hono webhooks, different paths = different logging

### Real Example

Request 40 seconds apart, same user + similar prompt:

- First request: succeeded, created generation with slug `019c2b10-baseballgrandpa666-tim-sweeny-s-zzt...`
- Second request: failed with 500, no useful error in logs

Root cause: UUIDv7 first 8 chars have ~65 second resolution, so both got same prefix, causing UNIQUE constraint violation on slug.

We only found this by:

1. Noticing the error in Cloudflare dashboard
2. Manually querying D1 for existing slugs
3. Understanding UUIDv7 timestamp structure

---

## Available Tools

### D1/Drizzle Error Structure

Errors have a cause chain. The root cause contains:

```typescript
{
  message: "UNIQUE constraint failed: generations.slug",
  code: "SQLITE_CONSTRAINT",           // Base SQLite error
  extendedCode: "SQLITE_CONSTRAINT_UNIQUE",  // Specific constraint type
  rawCode: 2067,                       // Numeric code
}
```

For query errors (`DrizzleQueryError`):

```typescript
{
  query: "INSERT INTO ...",   // The SQL that failed
  params: [...],              // Bound parameters
  cause: { /* SQLite error */ }
}
```

### SQLite Error Codes

Common codes we might encounter:

| Code                         | Meaning                      |
| ---------------------------- | ---------------------------- |
| SQLITE_CONSTRAINT            | Generic constraint violation |
| SQLITE_CONSTRAINT_UNIQUE     | Unique constraint failed     |
| SQLITE_CONSTRAINT_PRIMARYKEY | Primary key violation        |
| SQLITE_CONSTRAINT_FOREIGNKEY | Foreign key violation        |
| SQLITE_CONSTRAINT_NOTNULL    | NOT NULL constraint          |
| SQLITE_BUSY                  | Database locked              |
| SQLITE_READONLY              | Write to read-only DB        |
| SQLITE_IOERR                 | Disk I/O error               |
| SQLITE_CORRUPT               | Database corruption          |

### oRPC Error Handling

**Interceptors** - Run after handler throws, before response:

```typescript
onError((error) => {
  // Log, transform, or re-throw
  // Has access to full error including cause chain
})
```

**Type-safe errors** - Define expected error shapes:

```typescript
const base = os.errors({
  NOT_FOUND: { status: 404 },
  CONFLICT: { status: 409, data: z.object({ ... }) }
})
```

**Lifecycle hooks**:

- `onStart` - Before handler
- `onSuccess` - After successful handler
- `onError` - After error
- `onFinish` - Always, after response

### Hono Error Handling

**app.onError()** - Catch-all for errors that escape oRPC:

```typescript
app.onError((error, c) => {
  // Return Response
})
```

**HTTPException** - Intentional errors with status codes

### Cloudflare Context

Available on every request:

- `cf-ray` header - Unique request ID
- Request method, path, headers
- Worker observability captures console.log/error

---

## Current Implementation

### What We Have

`apps/server/src/utils/error-logging.ts`:

```typescript
function getRootCause(error) {
  // Recursively finds deepest .cause
}

function logError(error) {
  const rootCause = getRootCause(error)
  console.error('request_error', {
    message: error.message,
    cause: rootCause?.message,
    code: rootCause?.code,
  })
}
```

Used as oRPC interceptor in `index.ts`:

```typescript
interceptors: [onError(logError)]
```

### What's Missing

1. **extendedCode, rawCode** - Not extracted
2. **query, params** - Not extracted from DrizzleQueryError
3. **Request context** - No requestId, path, method in logs
4. **Hono catch-all** - No app.onError() for webhook errors
5. **Error transformation** - All errors return generic 500

---

## Design Principles

1. **Capture everything, filter later** - Don't predefine what's "important"
2. **Structured logging** - Objects, not formatted strings
3. **Request tracing** - Every log tied to a request ID
4. **Layered handling** - oRPC for API, Hono for webhooks, both log consistently
5. **Don't hide errors** - Surface actionable info to client where safe

---

## Open Questions

1. What do fal.ai errors look like? Need to capture a real one.
2. What do Runware errors look like? Need to capture a real one.
3. Should we transform specific errors (e.g., UNIQUE → 409 Conflict) or just log better?
4. How much error detail is safe to return to clients?

---

## Next Steps

- [ ] Improve error extraction to capture full D1 error shape
- [ ] Add request context (requestId, path, method) to all logs
- [ ] Add Hono app.onError() for webhook routes
- [ ] Capture real provider errors to understand their shape
- [ ] Decide on client-facing error responses

---

## References

### D1 / Drizzle

- [Drizzle ORM - Cloudflare D1](https://orm.drizzle.team/docs/connect-cloudflare-d1)
- [Drizzle D1 HTTP API with Drizzle Kit](https://orm.drizzle.team/docs/guides/d1-http-with-drizzle-kit)
- [D1 Community Projects](https://developers.cloudflare.com/d1/reference/community-projects/)
- [GitHub: Drizzle D1 foreign key constraint issue #4089](https://github.com/drizzle-team/drizzle-orm/issues/4089)
- [GitHub: Drizzle sqlite constraint error clarity #4103](https://github.com/drizzle-team/drizzle-orm/issues/4103)
- [GitHub: Drizzle error handling feature request #4660](https://github.com/drizzle-team/drizzle-orm/issues/4660)

### SQLite Error Codes

- [SQLite Result Codes](https://www.sqlite.org/rescode.html)
- [SQLite Extended Result Codes](https://www.sqlite.org/rescode.html#extrc)

### oRPC

- [oRPC Error Handling](https://orpc.dev/docs/error-handling) - ORPCError class, type-safe errors
- [oRPC OpenAPI Error Handling](https://orpc.dev/docs/openapi/error-handling) - HTTP status mappings
- [oRPC Middleware](https://orpc.dev/docs/middleware) - Interceptors, lifecycle hooks
- [oRPC Client Error Handling](https://orpc.dev/docs/client/error-handling) - Client-side error handling
- [oRPC Customizing Error Response](https://orpc.dev/docs/openapi/advanced/customizing-error-response) - Custom error formats
- [oRPC Validation Errors](https://orpc.dev/docs/advanced/validation-errors) - Zod validation error handling
- [Pino Integration](https://orpc.dev/docs/integrations/pino) - Structured logging
- [Sentry Integration](https://orpc.dev/docs/integrations/sentry) - Error tracking
- [OpenTelemetry Integration](https://orpc.dev/docs/integrations/opentelemetry) - Distributed tracing

### Hono

- [Hono Error Handling](https://hono.dev/docs/api/hono#error-handling)
- [Hono HTTPException](https://hono.dev/docs/api/exception)

### Cloudflare Workers Observability

- [Workers Logs](https://developers.cloudflare.com/workers/observability/logs/workers-logs/)
- [Workers Logpush](https://developers.cloudflare.com/workers/observability/logs/logpush/)
- [Tail Workers](https://developers.cloudflare.com/workers/observability/logs/tail-workers/)

### Observability API (underdocumented)

```
POST /accounts/{account_id}/workers/observability/telemetry/query
POST /accounts/{account_id}/workers/observability/telemetry/keys
POST /accounts/{account_id}/workers/observability/telemetry/values
```
