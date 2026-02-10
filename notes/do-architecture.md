# Durable Object Architecture

How generation orchestration might look with Durable Objects. Not a strict plan — a starting point we'll iterate on.

**Update: rename `outputs` -> `arifacts`**

## Core Idea

The inference job is transient plumbing. The artifacts are what matter. So:

- **Durable Object** owns the in-flight request. All the messy transitional state — partial completion, retries, "got 3 of 4 outputs," delivery quirks — lives here. Single-threaded, no race conditions, no reconciliation logic.
- **D1** is the artifact library. Outputs are written as they complete. The generation record is written when the job finishes. No pending/partial records cluttering queries.

The DO exists for seconds (single image) to minutes (video), then it's done. The data lives in D1 and R2 forever.

## Request Lifecycle

### 1. Client submits a request

```
POST /generations { model, input, count: 4, tags: [...] }
```

Server generates a UUIDv7, creates a DO addressed by `idFromName(uuid)`, forwards the request, returns the ID.

```typescript
const id = uuidv7()
const stub = env.GENERATION_MANAGER.get(env.GENERATION_MANAGER.idFromName(id))
await stub.create({ id, model, input, count, tags })
return { id }
```

### 2. DO orchestrates

The DO is now the authority on this request. It:

- Stores the request params in its durable storage
- Fires off N individual Runware requests (one per output)
- Tracks which have completed, which failed
- Sets a timeout alarm

No DB write yet. The request exists only in the DO.

### 3. Outputs arrive

For each Runware response (sync or webhook):

- Stream from `imageURL` → tee to R2 at `outputs/{outputId}`
- Write the output record to D1
- Update internal count (3/4 done)
- Notify any connected subscribers (future: WebSocket)

**Outputs hit D1 individually, as they complete.** A client polling for outputs sees them appear one by one.

### 4. Job finishes

When all outputs are resolved (or the timeout fires):

- Write the generation record to D1 with final status
- Apply generation-level tags
- Internal state is no longer needed — DO goes idle and is eventually evicted

### 5. Client access

Two paths, depending on timing:

| Question                      | Where it goes         | Notes                                  |
| ----------------------------- | --------------------- | -------------------------------------- |
| "What's happening right now?" | DO (if alive)         | Status, progress, ETA                  |
| "Show me outputs"             | D1                    | Outputs written as they arrive         |
| "Show me the generation"      | D1 (after completion) | Or DO if still active                  |
| "Browse my library"           | D1                    | DOs are long gone, everything is in D1 |

A simple facade: `GET /generations/{id}` checks the DO first, falls back to D1. Or keep them as separate concerns — status endpoint (DO) vs library endpoint (D1).

Must work without WebSockets. Polling D1 for outputs and DO for status is the baseline. WebSocket subscriptions on the DO are a natural extension later.

## How DOs Work (Practical Notes)

### Addressing

```typescript
// Deterministic: same name always gets same DO instance
const doId = env.GENERATION_MANAGER.idFromName(generationUuid)
const stub = env.GENERATION_MANAGER.get(doId)
```

The UUIDv7 we give the client IS the DO address. No lookup table needed.

### State

DOs have two kinds of state:

- **In-memory**: fast, lost on eviction. Good for tracking active WebSocket connections.
- **Durable storage**: key-value, persists across evictions and restarts. This is where request state lives.

```typescript
// Inside the DO
await this.ctx.storage.put('request', { model, input, count })
await this.ctx.storage.put('progress', { received: 2, total: 4 })
```

### Concurrency

All requests to a DO are serialized. If a webhook and a client poll arrive at the same time, they're processed one at a time. No locks, no transactions, no race conditions.

### Alarms

DOs can set a future alarm — a timer that fires even if the DO is hibernated.

```typescript
// Set a 5-minute timeout
await this.ctx.storage.setAlarm(Date.now() + 5 * 60 * 1000)

// When it fires
async alarm() {
  // Check if we're still waiting for outputs
  // Mark as failed/timed out, persist to D1
}
```

### Hibernation

A DO that has no active work (waiting on a webhook) can hibernate. It costs nothing while sleeping. When a webhook arrives, it wakes up and picks up where it left off.

### Lifecycle

```
Created → Active (processing) → Idle → Evicted
                                  ↑
                          Hibernated (waiting for webhook/alarm)
```

After persisting to D1, the DO has done its job. It goes idle and is eventually evicted. The durable storage persists but we don't need it — D1 has the truth.

## Webhook Routing

The webhook handler becomes trivial:

```typescript
webhook.post('/', async (c) => {
  const generationId = c.req.query('generation_id')
  const payload = await c.req.json()

  const stub = env.GENERATION_MANAGER.get(env.GENERATION_MANAGER.idFromName(generationId))
  await stub.handleWebhook(payload)

  return c.body(null, 200)
})
```

All the resolution logic — parsing Runware payloads, handling errors, deciding what to store — lives inside the DO. The webhook route is just a router.

## Schema

### D1: The Artifact Library

These tables only contain completed data. No pending records (except briefly for generation, see note).

```sql
generations
  id                text PK         -- UUIDv7 (same as DO address)
  status            text            -- ready | failed
  provider          text            -- 'runware'
  model             text
  input             json            -- request payload (provenance)
  output_count      integer         -- how many outputs were produced
  created_at        integer         -- when the request was made
  completed_at      integer         -- when the last output resolved

outputs
  id                text PK         -- UUIDv7
  generation_id     text FK         -- → generations.id
  content_type      text            -- image/jpeg, video/mp4, etc.
  metadata          json            -- cost, seed, dimensions, provider fields
  created_at        integer         -- when this output was produced

tags
  tag               text
  target_type       text            -- 'generation' | 'output'
  target_id         text
  PK (tag, target_type, target_id)
```

R2 key: `outputs/{output_id}`

**Note on generation timing:** The generation record is written when the job completes, not when the request starts. While the DO is active, the generation exists only in the DO. Outputs are written to D1 as they arrive, referencing a `generation_id` that doesn't have a corresponding row yet — this is fine, we don't enforce the FK in SQLite, and the generation row arrives shortly after.

Alternative: write a minimal generation row at creation time (just id + created_at) and update it on completion. Depends on whether we want in-flight requests to be queryable from D1. Probably not — that's the DO's job.

### DO: Transient Request State

```typescript
// Stored in DO durable storage
type RequestState = {
  id: string
  model: string
  input: Record<string, unknown>
  tags: string[]
  count: number
  status: 'active' | 'completing' | 'done' | 'failed'

  // Per-output tracking
  tasks: Array<{
    outputId: string
    status: 'pending' | 'submitted' | 'streaming' | 'ready' | 'failed'
    runwareTaskUUID?: string
    error?: string
  }>

  createdAt: number
  timeoutAt: number
}
```

This state is transient. Once the generation and all outputs are in D1, it can be discarded.

## Task-Type Handling

All of this is internal to the DO. The outside world sees the same interface.

### Image (single or batch as N×1)

```
DO receives create({ count: 4 })
  → fires 4 sync Runware requests (concurrent)
  → as each returns: stream imageURL → tee to R2, write output to D1
  → when all 4 done: write generation to D1
```

Fast path. Total time ≈ slowest single image (~3-8s).

### Video (async, webhook-based)

```
DO receives create({ model: 'video-model', count: 1 })
  → submits to Runware with webhookURL and deliveryMethod: 'async'
  → sets timeout alarm (10 min?)
  → hibernates

Webhook arrives → DO wakes up
  → streams video URL → tee to R2, write output to D1
  → write generation to D1
```

### Error Handling

Internal to the DO:

- Individual output fails → mark that task failed, continue others
- All outputs fail → write generation as failed to D1
- Timeout alarm fires → mark remaining tasks as timed out, persist what we have
- DO crashes/restarts → durable storage has the state, resume from where we were

## What This Replaces

| Current                                              | With DOs                      |
| ---------------------------------------------------- | ----------------------------- |
| `generations` table with pending/ready/failed        | D1 only has completed records |
| Webhook handler with DB lookups, idempotency         | One-liner that routes to DO   |
| `resolveRunwareWebhook` + `fetchUrl` + base64 decode | Stream + tee inside DO        |
| `batch:{id}` tag hack for multi-output               | Proper `outputs` table        |
| JSON tags column                                     | Junction table                |
| Polling DB for status                                | Poll DO (or WebSocket later)  |

## Future Extensions (Not Now)

- **WebSocket subscriptions**: Client connects to DO, gets real-time output notifications. Natural fit — DOs support hibernatable WebSockets natively.
- **Progress events**: For slow tasks, the DO could report intermediate progress (e.g., video rendering %).
- **Retry logic**: DO detects a failed output and automatically retries, transparent to the client.
- **Priority queues**: DO could rate-limit or prioritize based on tags/client.

## Related

- `notes/redesign-delivery-and-schema.md` — Delivery strategy discoveries (uploadEndpoint experiments, stream+tee decision)
