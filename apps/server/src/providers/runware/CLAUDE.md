# Runware Provider

Queue-based image generation via Runware's API. Submit a request, receive results via webhook, store artifacts in R2, project metadata to D1.

All exported functions follow the `(ctx: Context, args)` pattern.

## Event Flow

```
Client → router → create.ts → Runware API
                                     ↓
                             webhook.ts (POST)
                                     ↓
                           generationDo.ts (recordWebhook)
                                     ↓
                             webhook.ts (waitUntil)
                           fetch CDN → store R2 → write D1
                                     ↓
                           generationDo.ts (confirmOutputs)
```

## Files

| File              | Role                                                                                                                                                                                                     |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `create.ts`       | Create a generation: dispatch to Runware API, initialize DO with result. Returns the generation ID.                                                                                                      |
| `generationDo.ts` | Durable Object — coordination-only state register. Tracks webhooks received, outputs confirmed, completion. Does **no I/O** (no fetches, no storage writes). Uses sync KV (`ctx.storage.kv`).            |
| `webhook.ts`      | Hono route + background processing. Receives Runware's webhook, delegates validation to the DO, then runs CDN fetch → R2 upload → D1 write in `waitUntil`.                                               |
| `stub.ts`         | Typed stub factory for DO RPC calls. CF's `Rpc.Provider` collapses sync DO methods to `never`, so this defines the actual RPC contract separately.                                                       |
| `schemas.ts`      | Zod schemas matching Runware's API shapes exactly (no renaming). Input validation + webhook payload parsing.                                                                                             |
| `errors.ts`       | Typed error system with discriminated unions. Two levels: generation-level errors (`meta.error`) and output-level errors (individual output failures). Factory functions ensure consistent construction. |
| `types.ts`        | Shared types for DO state, RPC arguments, and output shapes.                                                                                                                                             |
| `model-search.ts` | Standalone Runware model catalog search. No dependency on the generation system.                                                                                                                         |
| `index.ts`        | Re-exports `createGeneration` and `webhook`.                                                                                                                                                             |

## Architecture Notes

### DO is coordination-only

The DO stores state and validates webhooks but performs zero I/O. All heavy work (CDN fetches, R2 uploads, D1 writes) happens at the Worker level in `waitUntil`. This keeps the DO fast, avoids blocking Runware's webhook response, and means DO methods can be synchronous KV reads/writes.

### Two-level error system

**Generation-level errors** (`meta.error: GenerationError`) represent failures of the generation as a whole — dispatch rejected, timeout, D1 projection failure. Stored on the generation metadata.

**Output-level errors** (`Output` with `type: 'error'`) represent individual output failures — a single CDN fetch failed, an R2 upload failed, webhook payload didn't validate. These sit alongside successful outputs in the `outputs` array.

A generation can have a mix of successful and errored outputs. The two levels are independent.

### D1 projection failure

When all outputs are confirmed but the D1 write fails, the generation's outputs exist in R2 and the DO has the complete state, but D1 has no record. This is a **projection failure** — the read model is broken, not the generation itself.

The error is recorded as `meta.error` with code `projection_failed`. The DO state (queryable via `getState`) still contains all successful outputs with their R2 keys, so the data is recoverable.

In practice, D1 write failures have always indicated schema/migration bugs, never transient issues. There is no automatic retry — this requires manual intervention: fix the underlying cause, then replay from DO state or clear the error.

### Webhook returns 200 immediately

The webhook handler always returns 200 to Runware before processing starts. Background work runs in `waitUntil`. If we returned errors, Runware would retry and we'd get duplicate processing.
