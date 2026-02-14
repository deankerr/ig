# Typed Errors in Stateful Processes

## The Problem

A stateful process — like a Durable Object managing an async generation lifecycle — can fail at many different points. Each failure produces a different shape of data. And because the process is long-lived and stores its state, you can't just throw and forget. Errors need to be _stored_, then later _read back_ and _acted on_.

With `error: unknown` everywhere, every consumer has to guess the shape. You end up writing defensive checks against structures you half-remember, or just giving up and logging `JSON.stringify(error)`.

## What We Did

We looked at every error site in the module and asked: what data does this actually produce?

It turned out there were only a handful of shapes. And they naturally grouped by what kind of thing went wrong:

```typescript
// HTTP failures — same shape whether it's the API call or a CDN fetch.
// The code tells you which stage; the data is the same.
type HttpError = { code: 'http_error' | 'fetch_failed'; url: string; status: number; body: string }

// The provider rejected the request with structured errors
type ApiRejection = { code: 'api_rejected'; errors: RunwareError[] }

// We gave up waiting
type TimeoutError = { code: 'timeout'; received: number; expected: number }
```

For per-output errors (each image in a batch can fail independently):

```typescript
// Webhook payload didn't match our schema
type ValidationError = { code: 'validation'; issues: FlatError }

// Provider sent an error in the webhook
type WebhookError = { code: 'webhook_error'; errors: RunwareError[] }

// R2 storage threw
type StorageError = { code: 'storage_failed'; r2Key: string; cause: SerializedError }
```

Then the state types become:

```typescript
type GenerationError = HttpError | ApiRejection | TimeoutError
type OutputErrorDetail = ValidationError | WebhookError | HttpError | StorageError
```

Consumers narrow with `switch (error.code)`. That's it.

## Key Principles

**Don't model exact shapes, indicate what's in there.** We're not trying to type every field an external API might return. `RunwareError` is `{ code: string; message: string; [key: string]: unknown }` — a `z.looseObject` that says "at least these two fields, probably more." That's enough to display, log, and route on.

**Use what your libs already give you.** Zod v4's `z.flattenError()` turns a complex `ZodError` instance into a plain `{ formErrors: string[], fieldErrors: Record<string, string[]> }`. Our `serializeError()` turns any thrown value into a `Record<string, unknown>` with the cause chain preserved. These already exist — use them instead of inventing new serialization.

**Share shapes across stages.** An HTTP error is an HTTP error whether it happened at the API dispatch or the CDN fetch. One type, different `code` values. Recognise when two "different" errors are the same structural thing.

**It's a few lines.** The entire type system for this module is ~10 lines of type aliases and two union types. No classes, no inheritance, no error code registry. Just discriminated unions with a `code` field.

## What It Gets You

- **Every error site is visible in the types.** You can scan the union and know exactly what can go wrong and where.
- **The stored data is predictable.** Consumers don't need to guess — they narrow on `code` and get typed fields.
- **Code at each error site is cleaner.** Instead of ad-hoc object literals into `unknown`, you construct a typed value. The intent is obvious.
- **It composes.** The same `HttpError` type appears in both the top-level and per-output unions because it's the same kind of failure.

## When To Do This

When you have a module that stores errors rather than throwing them. The moment `error: unknown` appears on a type that gets persisted or returned to a caller, consider whether a small discriminated union would make the code easier to write _and_ read.
