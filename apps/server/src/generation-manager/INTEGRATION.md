# Generation Manager DO Integration Guide

This document explains how to integrate the Generation Manager Durable Object prototypes into the existing ig infrastructure.

## Quick Start

### 1. Add DO to Alchemy Configuration

```typescript
// packages/infra/alchemy.run.ts
import { DurableObjectNamespace } from "alchemy/cloudflare"

// After other resource definitions...
const generationManager = await DurableObjectNamespace("generation-manager", {
  className: "GenerationManager",
})

// Add to server bindings
const server = await Worker("server", {
  bindings: {
    // ... existing bindings
    GENERATION_MANAGER: generationManager,
  },
})
```

### 2. Export DO Class from Worker Entry

```typescript
// apps/server/src/index.ts

// Add to exports
export { GenerationManager } from "./generation-manager"
// OR for Runware-specific:
export { RunwareGenerationDO } from "./generation-manager/runware-generation-do"
```

### 3. Add Type Definitions

```typescript
// packages/env/env.d.ts

import type { GenerationManager } from "../apps/server/src/generation-manager"

declare global {
  interface Env {
    GENERATION_MANAGER: DurableObjectNamespace<GenerationManager>
  }
}
```

## Client Usage Patterns

### Pattern A: Fire and Forget with Polling

```typescript
// Create generation (returns immediately)
const response = await fetch("/api/generations", {
  method: "POST",
  body: JSON.stringify({
    provider: "runware",
    model: "civitai:108@1",
    input: {
      positivePrompt: "a beautiful sunset",
      numberResults: 4,  // Batch of 4 images
    },
  }),
})
const { id } = await response.json()

// Poll for completion
let status = "pending"
while (status !== "ready" && status !== "failed") {
  await sleep(1000)
  const stateRes = await fetch(`/api/generations/${id}`)
  const state = await stateRes.json()
  status = state.status
  console.log(`Progress: ${state.receivedCount}/${state.expectedCount}`)
}
```

### Pattern B: Long Poll (Wait for Completion)

```typescript
// Single request that waits for all results
const response = await fetch("/api/generations?wait=true&timeout=60000", {
  method: "POST",
  body: JSON.stringify({
    provider: "runware",
    model: "civitai:108@1",
    input: {
      positivePrompt: "a beautiful sunset",
      numberResults: 4,
    },
  }),
})

const result = await response.json()
// result.status === "ready" (or "failed" or timeout)
// result.results contains all 4 images
```

### Pattern C: WebSocket Streaming

```typescript
// Create generation
const createRes = await fetch("/api/generations", {
  method: "POST",
  body: JSON.stringify({
    provider: "runware",
    model: "civitai:108@1",
    input: {
      positivePrompt: "a beautiful sunset",
      numberResults: 4,
    },
  }),
})
const { id } = await createRes.json()

// Connect WebSocket for real-time updates
const ws = new WebSocket(`wss://api.example.com/generations/${id}/stream`)

ws.onmessage = (event) => {
  const data = JSON.parse(event.data)

  switch (data.type) {
    case "progress":
      console.log(`${data.payload.received}/${data.payload.expected} images ready`)
      break

    case "image":
      // Display image as it arrives
      displayImage(data.payload.url)
      break

    case "complete":
      console.log(`Generation complete: ${data.payload.resultCount} images`)
      ws.close()
      break

    case "error":
      console.error(`Error: ${data.payload.message}`)
      ws.close()
      break
  }
}

// Subscribe to updates
ws.onopen = () => {
  ws.send(JSON.stringify({ type: "subscribe" }))
}
```

## Webhook Routing

Modify the Runware webhook handler to route to DO:

```typescript
// apps/server/src/providers/runware/webhook.ts

import { GenerationManagerClient } from "../../generation-manager/client"

webhook.post("/", async (c) => {
  const generationId = c.req.query("generation_id")
  if (!generationId) {
    return c.json({ error: "Missing generation_id" }, 400)
  }

  const payload = await c.req.json()

  // Route to DO instead of handling directly
  const client = new GenerationManagerClient(c.env.GENERATION_MANAGER)
  const result = await client.handleWebhook(generationId, "runware", payload)

  return c.json(result)
})
```

## Migration Strategy

### Phase 1: Parallel Operation

Run DO-based handling alongside existing code:
- Add feature flag: `use_do_for_batch`
- Enable DO only for Runware requests with `numberResults > 1`
- Compare results, ensure batch aggregation works

### Phase 2: Full Migration

- Route all Runware webhooks through DO
- Add WebSocket endpoint for streaming
- Monitor for issues

### Phase 3: Generalize

- Apply same pattern to fal.ai
- Enable long-poll for all providers
- Deprecate direct webhook handlers

## Troubleshooting

### DO Not Receiving Webhooks

1. Check generation ID in webhook URL matches DO ID
2. Verify DO is exported from worker entry
3. Check Alchemy binding configuration

### WebSocket Disconnects Unexpectedly

1. Implement ping/pong keep-alive (auto-handled by DO)
2. Check client-side reconnection logic
3. Verify hibernation is configured

### Results Missing After Hibernation

1. Ensure state is persisted before any await
2. Check storage.put calls in webhook handler
3. Verify loadState is called after wake

### Long Poll Timeout

1. Cloudflare has 60s request limit
2. Keep timeout < 55s for safety margin
3. Return partial state on timeout, let client retry

## Cost Considerations

Durable Objects pricing:
- **Requests**: $0.15 per million
- **Duration**: $12.50 per million GB-s

With hibernation:
- DO sleeps when no activity
- WebSocket connections stay open without charges
- Wake up on webhook or client message
- Typical generation: ~1-5 seconds active time

Estimated cost per generation with DO: ~$0.00001 (negligible)
