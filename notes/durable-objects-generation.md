# Durable Objects for Generation Management

## Executive Summary

This document explores using Cloudflare Durable Objects (DOs) to manage the generation lifecycle, with a focus on solving the Runware batch webhook problem and enabling real-time client communication.

**Key Finding:** Durable Objects are an excellent fit for generation management. They solve the batch webhook aggregation problem, enable real-time WebSocket communication with clients, and provide flexibility in execution strategy.

## Current Architecture Problems

### 1. Runware Batch Webhook Issue

When Runware generates multiple images (e.g., `numberResults: 4`), it sends **separate webhooks for each result** as they complete. The current webhook handler (`apps/server/src/providers/runware/webhook.ts:33-36`):

```typescript
// Idempotency: if already processed, return success
if (gen.status === "ready" || gen.status === "failed") {
  return c.json({ ok: true, alreadyProcessed: true })
}
```

**Problem:** The first webhook marks the generation as "ready", causing all subsequent webhooks to be ignored. Only 1 of N images is captured.

### 2. No Real-Time Client Communication

Clients must poll for generation status. There's no way to:
- Keep the HTTP connection open until completion
- Stream results as they arrive
- Get progress updates (especially important for video generation)

### 3. Fixed Execution Strategy

Every generation follows the same path: queue submission → webhook. There's no way to:
- Wait synchronously for fast models
- Use provider WebSocket APIs for real-time results
- Fall back to polling if webhooks fail

## Proposed Architecture: Generation Manager DO

### Overview

Each generation request creates a Durable Object instance that:
1. Manages the full lifecycle of that generation
2. Aggregates multiple webhook callbacks (solving batch problem)
3. Accepts client WebSocket connections for real-time updates
4. Chooses optimal execution strategy based on context
5. Persists state for reliability

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Client Options                               │
├─────────────────────────────────────────────────────────────────────┤
│  Option A: Fire & Forget                                            │
│  POST /generations → returns ID immediately                         │
│  GET  /generations/:id → poll for status                            │
├─────────────────────────────────────────────────────────────────────┤
│  Option B: Long Poll                                                │
│  POST /generations?wait=true → holds connection until complete      │
├─────────────────────────────────────────────────────────────────────┤
│  Option C: WebSocket                                                │
│  WS /generations/:id/stream → real-time events                      │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Worker (apps/server)                              │
│                                                                      │
│  Routes requests to Generation Manager DO by generation ID          │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│              Generation Manager Durable Object                       │
│                                                                      │
│  State:                                                             │
│  - Generation record (provider, model, input, status)               │
│  - Expected result count                                            │
│  - Received results array                                           │
│  - Connected WebSocket clients                                      │
│                                                                      │
│  Capabilities:                                                       │
│  - Receive webhooks and aggregate results                           │
│  - Broadcast progress to connected clients                          │
│  - Choose execution strategy (sync/websocket/webhook)               │
│  - Store to R2 when complete                                        │
│  - Hibernate when idle (cost-effective)                             │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Provider APIs                                     │
├─────────────────────────────────────────────────────────────────────┤
│  Runware: HTTP POST with webhookURL                                 │
│  fal.ai: queue.submit with webhookUrl                               │
│  (Future: Provider WebSocket connections)                           │
└─────────────────────────────────────────────────────────────────────┘
```

### DO State Structure

```typescript
interface GenerationState {
  // Core generation data
  id: string
  provider: "fal" | "runware"
  model: string
  input: Record<string, unknown>
  status: "pending" | "submitted" | "processing" | "ready" | "failed"
  tags: string[]
  slug: string | null

  // Result tracking
  expectedCount: number       // e.g., 4 for batch of 4 images
  results: ProviderResult[]   // Accumulate as webhooks arrive

  // Execution context
  strategy: "webhook" | "sync" | "websocket"
  createdAt: number
  submittedAt?: number
  completedAt?: number

  // Error tracking
  errorCode?: string
  errorMessage?: string
}
```

### WebSocket Event Protocol

```typescript
// Events sent to connected clients
type WSEvent =
  | { type: "status"; status: GenerationState["status"] }
  | { type: "progress"; received: number; expected: number }
  | { type: "result"; index: number; output: ResolvedOutput }
  | { type: "complete"; outputs: ResolvedOutput[] }
  | { type: "error"; code: string; message: string }
```

### Execution Strategies

The DO can choose the optimal strategy based on:
- Provider capabilities
- Client preferences (e.g., `?wait=true`)
- Expected generation time (model-specific hints)

#### Strategy 1: Webhook (Current Default)

```
Client → Worker → DO.create() → Submit to provider with webhookURL
                      ↓
                 Return ID immediately

Provider → Webhook → Worker → DO.handleWebhook()
                                   ↓
                              Aggregate results
                              Notify WebSocket clients
                              Store when complete
```

Best for: Long-running generations, video, audio

#### Strategy 2: Synchronous Wait

```
Client ────────────────────────→ Worker ──→ DO.createAndWait()
       (connection held open)                    ↓
                                          Submit to provider
                                          Wait for webhook(s)
                                          Store results
Client ←───────────────────────── Worker ←── Return outputs
```

Best for: Fast models (< 30s), simple requests

#### Strategy 3: Provider WebSocket (Future)

```
DO → Open WebSocket to Runware SDK
Runware → Streams results via WebSocket
DO → Broadcasts to client WebSockets
```

Best for: Real-time streaming, progress updates

### Solving the Batch Problem

The key change: webhooks no longer mark a generation complete immediately. Instead:

```typescript
async handleWebhook(payload: unknown): Promise<void> {
  const result = await resolveWebhook(payload)

  // Accumulate result
  this.state.results.push(result)

  // Notify connected clients
  this.broadcast({
    type: "progress",
    received: this.state.results.length,
    expected: this.state.expectedCount
  })

  // Check if all results received
  if (this.state.results.length >= this.state.expectedCount) {
    await this.complete()
  }
}
```

**How expectedCount is determined:**

1. From input parameters: `input.numberResults` (Runware), `num_images` (fal)
2. From provider response at submission time
3. Default to 1 if not specified

### Client Integration Patterns

#### Pattern A: Simple Polling (Unchanged)

```typescript
const { id } = await api.generations.create({ ... })

// Poll until complete
let gen = await api.generations.get({ id })
while (gen.status === "pending") {
  await sleep(1000)
  gen = await api.generations.get({ id })
}
```

#### Pattern B: Long Poll

```typescript
// Connection held until generation completes
const result = await api.generations.create({
  ...input,
  wait: true,
  timeout: 60000 // Optional timeout
})
// result includes outputs directly
```

#### Pattern C: WebSocket Stream

```typescript
const { id } = await api.generations.create({ ... })

const ws = new WebSocket(`wss://api.example.com/generations/${id}/stream`)

ws.onmessage = (event) => {
  const data = JSON.parse(event.data)

  switch (data.type) {
    case "progress":
      console.log(`${data.received}/${data.expected} images ready`)
      break
    case "result":
      displayImage(data.output)
      break
    case "complete":
      ws.close()
      break
  }
}
```

### Hibernation Strategy

The DO uses Cloudflare's WebSocket Hibernation API to minimize costs:

- When idle (no activity), DO hibernates but keeps WebSockets connected
- WebSocket messages or webhook requests wake the DO
- State is persisted to DO storage before hibernation
- Ping/pong messages handled via `setWebSocketAutoResponse()`

```typescript
class GenerationManager extends DurableObject {
  async webSocketMessage(ws: WebSocket, message: string) {
    // Automatically wakes from hibernation
    const { type, payload } = JSON.parse(message)

    if (type === "subscribe") {
      // Client wants updates - already connected via hibernation
      this.sendCurrentState(ws)
    }
  }

  async webSocketClose(ws: WebSocket) {
    // Clean up when client disconnects
  }
}
```

### Infrastructure Changes

#### Alchemy Configuration

```typescript
// packages/infra/alchemy.run.ts
import { DurableObjectNamespace } from "alchemy/cloudflare"

const generationManager = await DurableObjectNamespace("generation-manager", {
  className: "GenerationManager",
})

const server = await Worker("server", {
  bindings: {
    // ... existing bindings
    GENERATION_MANAGER: generationManager,
  },
})
```

#### Type Definitions

```typescript
// packages/env/env.d.ts
import type { GenerationManager } from "../apps/server/src/generation-manager"

declare global {
  interface Env {
    GENERATION_MANAGER: DurableObjectNamespace<GenerationManager>
  }
}
```

### Migration Path

1. **Phase 1: Add DO Infrastructure**
   - Create GenerationManager DO class
   - Add Alchemy binding
   - Route webhooks through DO

2. **Phase 2: Migrate Batch Handling**
   - Enable DO for Runware requests with `numberResults > 1`
   - Test batch aggregation

3. **Phase 3: Add WebSocket Support**
   - Implement WebSocket endpoint
   - Add hibernation support
   - Test with clients

4. **Phase 4: Enable for All Generations**
   - Make DO the default path
   - Add long-poll support
   - Deprecate direct webhook handlers

### Trade-offs and Considerations

#### Benefits

1. **Solves batch problem definitively** - Results aggregated by design
2. **Real-time communication** - WebSocket support with hibernation
3. **Flexible execution** - Strategy per request
4. **Reliable state** - DO storage survives restarts
5. **Cost-effective** - Hibernation minimizes charges
6. **Observable** - All state in one place per generation

#### Costs/Risks

1. **Complexity** - More moving parts than stateless webhooks
2. **DO Limits** - 128MB memory, 30s CPU per request
3. **No Outgoing WS Hibernation** - Can't hibernate while connected to providers
4. **Migration effort** - Needs careful rollout

#### Limits to Consider

- DO request duration: 30s CPU time (can be extended with DO alarms)
- DO storage: 128MB per object
- WebSocket connections per DO: Limited by memory
- DO locations: May add latency vs edge execution

### Alternative Approaches Considered

#### 1. Database-Based Aggregation

Use D1 to track expected vs received results:

```sql
CREATE TABLE generation_results (
  generation_id TEXT,
  index INTEGER,
  result BLOB,
  PRIMARY KEY (generation_id, index)
);
```

**Rejected because:** Requires polling, complex transaction handling, no real-time capability

#### 2. Queue-Based Aggregation

Use Cloudflare Queues to batch webhook events:

```
Webhook → Queue → Batch Consumer → Aggregate
```

**Rejected because:** Adds latency, doesn't solve real-time requirements

#### 3. R2 Event Notifications

Store results directly to R2, use event notifications:

```
Webhook → Store to R2 → Event → Aggregate
```

**Rejected because:** Eventually consistent, complex coordination

### Conclusion

Durable Objects provide the ideal primitive for generation management:

- **Stateful coordination** for batch aggregation
- **WebSocket support** for real-time updates
- **Hibernation** for cost efficiency
- **Single source of truth** per generation

The prototype implementation demonstrates these concepts for Runware specifically, but the pattern applies to all providers.

## Prototype Files

See the prototype implementation in:
- `apps/server/src/generation-manager/generation-manager.ts` - DO class
- `apps/server/src/generation-manager/types.ts` - Type definitions
- `apps/server/src/generation-manager/client.ts` - Worker-side client

## References

- [Cloudflare Durable Objects WebSocket Hibernation](https://developers.cloudflare.com/durable-objects/best-practices/websockets/)
- [Runware JavaScript SDK - WebSocket Architecture](https://github.com/Runware/sdk-js)
- [Alchemy Durable Objects](https://alchemy.run/)
