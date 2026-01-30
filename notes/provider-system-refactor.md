# Provider System Refactor Research

This document analyzes the current provider system architecture and proposes improvements for schema generalization, service abstraction, and error handling.

## Table of Contents

1. [Current Flow Documentation](#current-flow-documentation)
2. [Schema Analysis](#schema-analysis)
3. [Service Layer Architecture](#service-layer-architecture)
4. [Error Handling Strategy](#error-handling-strategy)
5. [Questions for Dean](#questions-for-dean)

---

## Current Flow Documentation

### High-Level Flow

```
┌──────────────────┐    ┌────────────────────┐    ┌──────────────────┐
│  Client Request  │───▶│  Generation Create │───▶│ Provider Submit  │
│  POST /rpc/...   │    │  (insert pending)  │    │  (fal/runware)   │
└──────────────────┘    └────────────────────┘    └──────────────────┘
                                                           │
                                                           ▼
                                                  ┌──────────────────┐
                                                  │ Provider Process │
                                                  │ (async, remote)  │
                                                  └──────────────────┘
                                                           │
                                                           ▼
┌──────────────────┐    ┌────────────────────┐    ┌──────────────────┐
│  Generation Ready│◀───│  Webhook Handler   │◀───│ Provider Webhook │
│  (DB + R2)       │    │  (resolve output)  │    │  (POST /webhooks)│
└──────────────────┘    └────────────────────┘    └──────────────────┘
```

### Example: fal.ai Text-to-Image

**1. Client Request**

```typescript
// POST /rpc/generations.create
{
  "provider": "fal",                        // optional, defaults to "fal"
  "endpoint": "fal-ai/flux/schnell",
  "input": {
    "prompt": "a cat wearing a hat",
    "image_size": "landscape_16_9",
    "num_images": 1
  },
  "tags": ["test", "cats"],
  "slug": "cat-hat"                         // optional
}
```

**2. Generation Record Created**

```typescript
// INSERT into generations
{
  id: "01945abc-...",                       // UUIDv7
  status: "pending",
  provider: "fal",
  endpoint: "fal-ai/flux/schnell",
  input: { prompt: "...", image_size: "...", num_images: 1 },
  tags: ["test", "cats"],
  slug: "01945abc-cat-hat",                 // prefix + custom slug
  createdAt: "2026-01-29T...",
  // providerRequestId: null (not yet)
}
```

**3. Provider Submission**

```typescript
// submitToFal() using @fal-ai/client
fal.queue.submit("fal-ai/flux/schnell", {
  input: { prompt: "...", image_size: "..." },
  webhookUrl: "https://ig.example.com/webhooks/fal?generation_id=01945abc-..."
})
// Returns: { request_id: "fal-req-xyz" }
```

**4. Generation Updated**

```typescript
// UPDATE generations SET providerRequestId = "fal-req-xyz"
```

**5. Webhook Received** (async, later)

```typescript
// POST /webhooks/fal?generation_id=01945abc-...
// Headers: x-fal-webhook-signature, x-fal-webhook-timestamp, etc.
{
  "request_id": "fal-req-xyz",
  "status": "OK",
  "payload": {
    "images": [
      { "url": "https://fal.media/...", "content_type": "image/jpeg" }
    ],
    "seed": 12345,
    "timings": { "inference": 1.23 }
  }
}
```

**6. Output Resolution**

```typescript
// resolveOutputs(payload)
// → Finds images[0].url, fetches file, returns ArrayBuffer + contentType
```

**7. Final State**

```typescript
// R2: PUT generations/01945abc-... (image bytes)
// DB UPDATE:
{
  status: "ready",
  contentType: "image/jpeg",
  completedAt: "2026-01-29T...",
  providerMetadata: { images: [...], seed: 12345, timings: {...} }
}
```

---

### Example: Runware Image Generation

**1. Client Request**

```typescript
// POST /rpc/generations.create
{
  "provider": "runware",
  "endpoint": "runware:flux-schnell",       // endpoint naming is ad-hoc
  "input": {
    "positivePrompt": "a cat wearing a hat",
    "model": "runware:101@1",
    "width": 1024,
    "height": 768,
    "steps": 4
  },
  "tags": ["test", "cats"]
}
```

**2. Provider Submission** (different from fal)

```typescript
// submitToRunware() using fetch directly
// POST https://api.runware.ai/v1
[
  { taskType: "authentication", apiKey: "rw-..." },
  {
    taskType: "imageInference",             // derived from endpoint name
    taskUUID: "01945abc-...",               // generation id as task ID
    webhookURL: "https://ig.example.com/webhooks/runware?generation_id=01945abc-...",
    includeCost: true,
    positivePrompt: "...",                  // input spread directly into task
    model: "...",
    width: 1024,
    height: 768,
    steps: 4
  }
]
```

**3. Webhook Payload** (different structure)

```typescript
// POST /webhooks/runware?generation_id=01945abc-...
// May be wrapped: { data: [...] } or unwrapped
{
  "taskType": "imageInference",
  "taskUUID": "01945abc-...",
  "imageUUID": "img-xyz",
  "imageURL": "https://im.runware.ai/...",   // direct URL, not nested
  "cost": 0.0015,
  "seed": 12345
}
```

**Key Differences from fal:**

- No webhook signature verification
- Authentication in request body, not headers
- Uses generation ID as `taskUUID` (no separate request ID)
- Output URLs are top-level fields (`imageURL`), not nested objects
- Supports base64 data URIs as alternative to URLs
- Includes cost tracking in response

---

## Schema Analysis

### Current Generation Input Schema

```typescript
// packages/api/src/routers/generations.ts
z.object({
  provider: z.enum(["fal", "runware"]).optional().default("fal"),
  endpoint: z.string().min(1),              // wildly different meanings per provider
  input: z.record(z.string(), z.unknown()), // opaque passthrough
  tags: tagsSchema.optional().default([]),
  slug: slugSchema.optional(),
})
```

### Problems

1. **`endpoint` semantic overload**
   - For fal: `"fal-ai/flux/schnell"` (actual API endpoint path)
   - For runware: `"runware:flux-schnell"` (arbitrary identifier, used to derive taskType)
   - No validation that endpoint matches provider

2. **`input` is completely opaque**
   - fal uses: `prompt`, `image_size`, `num_images`, `seed`, etc.
   - runware uses: `positivePrompt`, `model`, `width`, `height`, `steps`, etc.
   - No type safety, no validation, no transformation layer

3. **Provider-specific logic in generic code**

   ```typescript
   // In submitToProvider()
   const taskType = endpoint.includes("video") ? "videoInference" : "imageInference"
   ```

   This is fragile - relies on endpoint naming convention.

4. **Preprocessing only for fal**
   - `image_size: "auto"` triggers LLM-based aspect ratio detection
   - This feature is hardcoded to fal, not available for runware

### Option A: Keep Opaque, Document Conventions

Keep the passthrough design but formalize provider conventions:

```typescript
// Provider contract (documented, not enforced)
interface ProviderConvention {
  endpointPattern: string    // regex or description
  requiredInputFields: string[]
  optionalInputFields: string[]
  outputFields: string[]
}

const FAL_CONVENTION: ProviderConvention = {
  endpointPattern: "fal-ai/{model}",
  requiredInputFields: ["prompt"],
  optionalInputFields: ["image_size", "num_images", "seed"],
  outputFields: ["images", "video", "audio"]
}
```

**Pros:**

- Minimal breaking changes
- Maintains flexibility for new providers
- fal's schema-per-endpoint design makes strict typing impractical anyway

**Cons:**

- No compile-time safety
- Easy to pass wrong fields
- Hard to build generic UI

### Option B: Provider-Specific Input Types

Define discriminated union for inputs:

```typescript
type CreateGenerationInput =
  | { provider: "fal"; endpoint: string; input: FalInput }
  | { provider: "runware"; endpoint: string; input: RunwareInput }

type FalInput = {
  prompt: string
  image_size?: "portrait_4_3" | "landscape_4_3" | "square_hd" | "auto"
  num_images?: number
  seed?: number
  // ... common fal fields
}

type RunwareInput = {
  positivePrompt: string
  model: string
  width?: number
  height?: number
  steps?: number
  // ... runware fields
}
```

**Pros:**

- Type safety
- Autocomplete in consumers
- Validation at API boundary

**Cons:**

- Must update types for every new endpoint/field
- fal has 500+ endpoints with different schemas
- Maintenance burden

### Option C: Hybrid - Common Fields + Provider Passthrough

```typescript
type CreateGenerationInput = {
  provider: "fal" | "runware"

  // Standardized fields (we transform to provider format)
  model: string              // e.g., "flux-schnell", "sd-xl"
  prompt: string
  negativePrompt?: string
  aspectRatio?: "16:9" | "4:3" | "1:1" | "3:4" | "9:16"
  seed?: number

  // Provider-specific passthrough
  providerOptions?: Record<string, unknown>
}
```

Then in `submitToProvider()`:

```typescript
function toFalInput(input: CreateGenerationInput): Record<string, unknown> {
  return {
    prompt: input.prompt,
    image_size: aspectRatioToFalSize(input.aspectRatio),
    seed: input.seed,
    ...input.providerOptions
  }
}

function toRunwareInput(input: CreateGenerationInput): Record<string, unknown> {
  return {
    positivePrompt: input.prompt,
    negativePrompt: input.negativePrompt,
    ...aspectRatioToDimensions(input.aspectRatio),
    seed: input.seed,
    ...input.providerOptions
  }
}
```

**Pros:**

- Common interface for consumers
- Provider differences encapsulated
- Still flexible via `providerOptions`

**Cons:**

- Need to maintain transformation logic
- "Lowest common denominator" limits advanced features

### Recommendation

**Start with Option A** (documented conventions) but **prepare for Option C** by:

1. Extracting provider-specific logic into dedicated modules
2. Defining a `ProviderAdapter` interface that can be evolved
3. Adding runtime validation for known endpoint patterns

---

## Service Layer Architecture

### Current State: Direct Dependencies

```
┌─────────────────────────────────────────────────────────────────┐
│                      Webhook Handler                             │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  import { db } from "@ig/db"                                ││
│  │  import { env } from "@ig/env/server"  // global singleton  ││
│  │                                                              ││
│  │  // Direct DB operations                                     ││
│  │  await db.select().from(generations)...                      ││
│  │  await db.update(generations)...                             ││
│  │  await db.insert(generations)...                             ││
│  │                                                              ││
│  │  // Direct R2 operations                                     ││
│  │  await env.GENERATIONS_BUCKET.put(...)                       ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

**Problems:**

1. `env` is a global singleton from `cloudflare:workers` - hard to test, implicit dependency
2. Each webhook handler duplicates DB/R2 operations
3. No centralized generation lifecycle management
4. Provider code knows about storage implementation details

### Proposed: Service Layer with Hono Context Injection

```
┌──────────────────────────────────────────────────────────────────┐
│                         Hono App                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  app.use("/*", servicesMiddleware)  // inject services     │  │
│  └────────────────────────────────────────────────────────────┘  │
│                              │                                    │
│                              ▼                                    │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │               c.var.generations                             │  │
│  │               c.var.storage                                 │  │
│  │               c.var.logger                                  │  │
│  └────────────────────────────────────────────────────────────┘  │
│                              │                                    │
│                              ▼                                    │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                   Webhook Handler                           │  │
│  │                                                             │  │
│  │  const { generations, storage } = c.var                     │  │
│  │                                                             │  │
│  │  const gen = await generations.get(id)                      │  │
│  │  await storage.put(id, data, contentType)                   │  │
│  │  await generations.complete(id, { contentType, metadata })  │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

### Service Interfaces

```typescript
// packages/api/src/services/generations.ts

export type GenerationService = {
  // Queries
  get(id: string): Promise<Generation | null>
  getByRequestId(requestId: string): Promise<Generation | null>

  // Commands
  create(input: CreateGenerationInput): Promise<Generation>
  markSubmitted(id: string, requestId: string, metadata?: Record<string, unknown>): Promise<void>
  complete(id: string, result: CompletionResult): Promise<void>
  fail(id: string, error: GenerationError): Promise<void>

  // Batch operations (for multi-output)
  createBatchItem(parentId: string, input: BatchItemInput): Promise<Generation>
}

type CompletionResult = {
  contentType: string
  providerMetadata?: Record<string, unknown>
}

type GenerationError = {
  code: string
  message: string
  providerMetadata?: Record<string, unknown>
}
```

```typescript
// packages/api/src/services/storage.ts

export type StorageService = {
  put(generationId: string, data: ArrayBuffer | Uint8Array, contentType: string): Promise<void>
  get(generationId: string): Promise<{ data: ReadableStream; contentType: string } | null>
  delete(generationId: string): Promise<void>
}
```

### Hono Integration

```typescript
// packages/api/src/services/middleware.ts
import { createMiddleware } from "hono/factory"

type Variables = {
  generations: GenerationService
  storage: StorageService
}

export const servicesMiddleware = createMiddleware<{
  Bindings: Env
  Variables: Variables
}>(async (c, next) => {
  c.set("generations", createGenerationService(c.env.DB))
  c.set("storage", createStorageService(c.env.GENERATIONS_BUCKET))
  await next()
})
```

### Refactored Webhook Handler

```typescript
// packages/provider-fal/src/webhook.ts

export function createFalWebhook() {
  const app = new Hono<{ Variables: Variables }>()

  app.post("/", async (c) => {
    const { generations, storage } = c.var
    const generationId = c.req.query("generation_id")

    // Verification...

    const gen = await generations.get(generationId)
    if (!gen) return c.json({ error: "Not found" }, 404)
    if (gen.status !== "pending") return c.json({ ok: true, alreadyProcessed: true })

    // Parse and resolve output...
    const outputs = await resolveOutputs(payload)
    const output = outputs[0]

    if (!output?.ok) {
      await generations.fail(generationId, {
        code: output?.errorCode ?? "UNKNOWN",
        message: output?.errorMessage ?? "Unknown error",
        providerMetadata: payload
      })
      return c.json({ ok: true })
    }

    await storage.put(generationId, output.data, output.contentType)
    await generations.complete(generationId, {
      contentType: output.contentType,
      providerMetadata: payload
    })

    return c.json({ ok: true })
  })

  return app
}
```

### Benefits

1. **Testable** - Services can be mocked
2. **Single source of truth** - Generation lifecycle in one place
3. **Provider-agnostic** - Webhooks don't know about Drizzle or R2
4. **Consistent logging** - Service layer handles event logging
5. **Transaction support** - Service can wrap related operations

### Migration Path

1. Create service interfaces and implementations
2. Add middleware to inject services
3. Refactor webhook handlers one at a time
4. Move generation logic from `generations.ts` router to services
5. Remove direct `db` and `env` imports from provider packages

---

## Error Handling Strategy

### Current State

```typescript
// Mix of approaches:

// 1. Plain throws (routers)
throw new Error("Generation not found")

// 2. oRPC errors (auth)
throw new ORPCError("UNAUTHORIZED", { message: "..." })

// 3. Result types (output resolution)
type ResolvedOutput =
  | { ok: true; data: ArrayBuffer; contentType: string }
  | { ok: false; errorCode: string; errorMessage: string }

// 4. Console logging (everywhere)
console.log("generation_created", { id, ... })
console.error("fal_webhook_verification_failed", { error })
```

### Analysis

**Result Types (current):**

- Used in `resolveOutputs()`, `resolveAutoAspectRatio()`, `verifyWebhook()`
- Work well for functions that can fail in expected ways
- Explicit error handling at call site
- No stack traces (good for expected failures)

**Plain Throws:**

- Used for "this shouldn't happen" cases
- Caught by oRPC/Hono error handlers
- Stack traces logged

**Console Logging:**

- Structured with event names: `console.log("event_name", { ...data })`
- Cloudflare dashboard aggregates these
- Inconsistent field names across events

### Option 1: Standardize on Result Types (neverthrow)

```typescript
import { ok, err, Result, ResultAsync } from "neverthrow"

// Service methods return Results
type GenerationService = {
  get(id: string): ResultAsync<Generation, NotFoundError>
  complete(id: string, result: CompletionResult): ResultAsync<void, UpdateError>
}

// Chaining with andThen
const result = await generations.get(id)
  .andThen(gen =>
    gen.status === "pending"
      ? ok(gen)
      : err(new AlreadyProcessedError(gen.status))
  )
  .andThen(gen =>
    storage.put(gen.id, data, contentType).map(() => gen)
  )
  .andThen(gen =>
    generations.complete(gen.id, { contentType })
  )

// Handle at boundary
if (result.isErr()) {
  return match(result.error)
    .with({ _tag: "NotFound" }, () => c.json({ error: "Not found" }, 404))
    .with({ _tag: "AlreadyProcessed" }, () => c.json({ ok: true }))
    .exhaustive()
}
```

**Pros:**

- Explicit error handling
- Type-safe error types
- No uncaught exceptions from business logic
- Great for composing fallible operations

**Cons:**

- Verbose for simple cases
- Learning curve
- Doesn't play well with `throw`-based libraries
- Extra dependency

### Option 2: Typed Error Classes + Throw

```typescript
// packages/api/src/errors.ts

export class GenerationError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message)
    this.name = "GenerationError"
  }

  toJSON() {
    return { code: this.code, message: this.message, ...this.context }
  }
}

export class NotFoundError extends GenerationError {
  constructor(resource: string, id: string) {
    super("NOT_FOUND", `${resource} not found: ${id}`, { resource, id })
  }
}

export class ProviderError extends GenerationError {
  constructor(provider: string, message: string, response?: unknown) {
    super("PROVIDER_ERROR", message, { provider, response })
  }
}

// Usage
const gen = await db.select()...
if (!gen) throw new NotFoundError("generation", id)

// Central error handler
app.onError((err, c) => {
  if (err instanceof GenerationError) {
    console.error(err.code, err.toJSON())
    return c.json(err.toJSON(), errorCodeToStatus(err.code))
  }
  // Unknown error
  console.error("INTERNAL_ERROR", { message: err.message, stack: err.stack })
  return c.json({ code: "INTERNAL_ERROR", message: "Internal error" }, 500)
})
```

**Pros:**

- Familiar throw/catch pattern
- Works with existing code
- Stack traces when needed
- Central error handling

**Cons:**

- Errors can be uncaught
- Less composable than Results
- Need discipline to use custom errors

### Option 3: Hybrid Approach

Use **Result types for expected failures** within functions, **throw for unexpected/unrecoverable** at boundaries:

```typescript
// Internal function - returns Result
async function resolveOutputs(payload: unknown): Promise<Result<Output[], OutputError>> {
  // ... returns ok() or err()
}

// Service method - throws on unexpected, returns Result on expected
async function complete(id: string, result: CompletionResult): Promise<void> {
  const gen = await db.select()...
  if (!gen) throw new NotFoundError("generation", id)  // Shouldn't happen if called correctly

  await db.update(generations).set({...})
  // void return - throws on DB error (unexpected)
}

// Webhook handler - converts Results to HTTP responses
app.post("/", async (c) => {
  const outputs = await resolveOutputs(payload)

  if (outputs.isErr()) {
    // Expected failure - handle gracefully
    await generations.fail(id, outputs.error)
    return c.json({ ok: true })
  }

  // Success path
  await storage.put(...)
  await generations.complete(...)
  return c.json({ ok: true })
})
```

### Logging Strategy

Regardless of error handling choice, standardize logging:

```typescript
// packages/api/src/logging.ts

export function log(event: string, data: Record<string, unknown>) {
  console.log(JSON.stringify({ event, timestamp: Date.now(), ...data }))
}

export function logError(event: string, error: unknown, context?: Record<string, unknown>) {
  console.error(JSON.stringify({
    event,
    timestamp: Date.now(),
    error: serializeError(error),
    ...context
  }))
}

function serializeError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      ...Object.fromEntries(
        Object.entries(error).filter(([k]) => !["name", "message", "stack"].includes(k))
      )
    }
  }
  return { value: String(error) }
}
```

### Recommendation

**Hybrid approach (Option 3)** with:

1. Keep existing Result types for output resolution
2. Add typed error classes for service layer
3. Central error handler in Hono
4. Standardized logging utility

Don't add neverthrow - the manual Result types work fine for the limited use cases, and full neverthrow would be overkill.

---

## Questions for Dean

### Schema & API Design

1. **Input normalization priority**: Should we invest in a common input schema (Option C), or is the passthrough approach working well enough in practice?

2. **Endpoint naming**: For runware, should we formalize endpoint naming? e.g., `runware:image:flux-schnell`, `runware:video:gen3`? Or keep freeform?

3. **Multi-output handling**: Current batch logic creates new generation records. Is this the right model, or should batches be a separate concept?

### Service Layer

4. **Service scope**: Should services be scoped per-request (via middleware) or singleton? Per-request allows request-specific context (tracing IDs, etc.) but adds overhead.

5. **Transaction boundaries**: Should `complete()` be atomic (storage + DB in one "transaction")? R2 doesn't support transactions with D1...

6. **Provider package dependencies**: Should provider packages depend on service interfaces, or receive services via function parameters?

   ```typescript
   // Option A: Import interface, receive via context
   import type { GenerationService } from "@ig/api/services"
   app.post("/", (c) => { const svc = c.var.generations; ... })

   // Option B: Receive everything as parameters
   export function createWebhook(services: { generations: ..., storage: ... }) { ... }
   ```

### Error Handling

7. **Error granularity**: How detailed should error codes be?
   - Coarse: `PROVIDER_ERROR`, `STORAGE_ERROR`, `VALIDATION_ERROR`
   - Fine: `FAL_TIMEOUT`, `FAL_RATE_LIMITED`, `RUNWARE_AUTH_FAILED`, `R2_WRITE_FAILED`

8. **User-facing errors**: Should errors in the generations table be suitable for end-user display, or internal-only? (Affects how we write error messages)

### Logging & Observability

9. **Tracing**: Should we add request IDs / trace IDs that flow through the entire request lifecycle? Cloudflare has built-in request IDs but they don't span async webhook processing.

10. **Metrics**: Any interest in structured metrics (counters, histograms) vs just logs? Cloudflare Analytics Engine could be an option.

---

## Next Steps

After you review and answer the questions:

1. **Phase 1**: Create service interfaces and implementations
2. **Phase 2**: Add Hono middleware for service injection
3. **Phase 3**: Refactor webhook handlers to use services
4. **Phase 4**: Standardize error types and logging
5. **Phase 5**: Consider input normalization if warranted

This can be done incrementally - each phase is independently valuable.
