# Runware-Only Server Redesign Proposal

## Executive Summary

This proposal outlines a ground-up redesign of the ig server layer, dropping fal.ai support entirely and focusing exclusively on Runware. The redesign incorporates lessons learned from the current system and leverages the Durable Objects prototype to solve the batch webhook problem.

**Key changes:**
- Single provider (Runware) eliminates abstraction overhead
- Durable Objects as the primary coordination layer
- Cleaner schema focused on what matters: artifacts and their provenance
- Mandatory raw request/response capture for debugging and auditing
- JSON fields for flexible Runware inputs without schema lock-in

## Rationale for Dropping fal.ai

1. **Schema complexity**: fal has 500+ endpoints, each with unique schemas. We've been treating inputs as opaque passthrough, which works but provides no validation or documentation.

2. **Cost**: Runware is significantly cheaper with comparable quality.

3. **API consistency**: Runware has standardized request/response structures across task types. One schema to understand, not 500.

4. **Batch problem**: The DO prototype was built specifically for Runware's webhook behavior. fal's queue API behaves differently.

5. **Simplicity**: A single-provider system is easier to reason about, test, and maintain.

## Core Design Principles

### 1. Artifacts Are Primary

The generation request is transient; the artifact is permanent. Our schema should reflect this.

### 2. Capture Everything

Raw request and response payloads must be stored for every generation. This enables debugging, auditing, and future analysis without guessing what the provider saw or returned.

### 3. JSON Fields for Flexibility

Runware supports many task types (imageInference, controlNet, inpainting, etc.) with varying parameters. Rather than modeling each field, we use JSON columns with light validation at the boundary.

### 4. Durable Objects for Coordination

The DO prototype elegantly solves batch aggregation and enables real-time updates. It becomes the core coordination primitive.

### 5. No Over-Abstraction

With a single provider, there's no need for provider abstraction layers. Direct, straightforward code wins.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Client                                       │
│   - ig-console (web UI)                                             │
│   - Discord bots                                                    │
│   - CLI tools                                                       │
└─────────────────────────────────────────────────────────────────────┘
                              │
            ┌─────────────────┼─────────────────┐
            │                 │                 │
            ▼                 ▼                 ▼
      REST/RPC API      WebSocket         Polling
      (fire & forget)   (real-time)       (fallback)
            │                 │                 │
            └─────────────────┼─────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Worker (Hono + oRPC)                              │
│                                                                      │
│  Routes:                                                            │
│  - POST /api/generations        → create                            │
│  - GET  /api/generations/:id    → get                               │
│  - GET  /api/generations        → list                              │
│  - WS   /generations/:id/stream → real-time updates                 │
│  - POST /webhooks/runware       → webhook receiver                  │
│  - GET  /files/:id              → artifact retrieval                │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│              Generation Manager Durable Object                       │
│                                                                      │
│  Per-generation instance that:                                      │
│  - Submits request to Runware                                       │
│  - Accumulates webhook callbacks                                    │
│  - Broadcasts progress via WebSocket                                │
│  - Stores completed artifacts to R2                                 │
│  - Writes final state to D1                                         │
│  - Hibernates when idle                                             │
└─────────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              │               │               │
              ▼               ▼               ▼
         Runware API         D1              R2
         (inference)     (metadata)      (artifacts)
```

## Database Schema

### `generations` Table

The core table, simplified and focused.

```sql
CREATE TABLE generations (
  -- Identity
  id TEXT PRIMARY KEY,              -- UUIDv7 for chronological ordering
  slug TEXT UNIQUE,                 -- Human-readable URL slug (optional)

  -- Status
  status TEXT NOT NULL DEFAULT 'pending',  -- pending | submitted | ready | failed

  -- Request (what we asked for)
  model TEXT NOT NULL,              -- Runware model identifier (e.g., civitai:108@1)
  task_type TEXT NOT NULL,          -- imageInference, controlNet, etc.
  input JSONB NOT NULL,             -- Full input parameters (flexible)

  -- Result tracking
  expected_count INTEGER NOT NULL DEFAULT 1,  -- numberResults from input

  -- Failure info
  error_code TEXT,
  error_message TEXT,

  -- Organization
  tags JSONB NOT NULL DEFAULT '[]',

  -- Raw payloads for debugging/auditing
  raw_request JSONB,                -- Exact payload sent to Runware
  raw_response JSONB,               -- Exact response from Runware (initial submission)

  -- Timestamps
  created_at INTEGER NOT NULL,      -- Unix ms
  submitted_at INTEGER,             -- When sent to Runware
  completed_at INTEGER              -- When all outputs received
);

CREATE INDEX idx_generations_created ON generations(created_at DESC);
CREATE INDEX idx_generations_status ON generations(status, created_at DESC);
CREATE INDEX idx_generations_slug ON generations(slug);
```

### `outputs` Table

Each generation can produce multiple artifacts. This is cleaner than the current approach of creating separate generation records with batch tags.

```sql
CREATE TABLE outputs (
  -- Identity
  id TEXT PRIMARY KEY,              -- UUIDv7
  generation_id TEXT NOT NULL REFERENCES generations(id) ON DELETE CASCADE,

  -- Position in batch
  index INTEGER NOT NULL,           -- 0-indexed position in batch

  -- Content
  content_type TEXT NOT NULL,       -- image/webp, video/mp4, etc.
  r2_key TEXT NOT NULL,             -- R2 object key

  -- Runware result metadata
  task_uuid TEXT NOT NULL,          -- Runware's taskUUID for this output
  cost REAL,                        -- Cost in credits (if includeCost=true)
  seed INTEGER,                     -- Seed used for this output
  metadata JSONB,                   -- Additional per-output data from Runware

  -- Raw webhook payload for this output
  raw_webhook JSONB NOT NULL,       -- Exact webhook data item

  -- Timestamps
  created_at INTEGER NOT NULL,

  UNIQUE(generation_id, index)
);

CREATE INDEX idx_outputs_generation ON outputs(generation_id);
```

### Why Two Tables?

**Current system**: Creates N generation records for N outputs, linked by `batch:parent_id` tag.

**Problems with current approach:**
- Queries for "all outputs of a generation" require tag matching
- Each batch output duplicates all input parameters
- No clear parent-child relationship in schema

**New approach**: One generation, many outputs.
- Clear 1:N relationship
- No data duplication
- Simpler queries: `SELECT * FROM outputs WHERE generation_id = ?`
- R2 keys can be organized: `outputs/{generation_id}/{index}`

## Durable Object Design

### State Structure

```typescript
interface GenerationDOState {
  // Identity
  id: string
  slug: string | null

  // Request
  model: string
  taskType: string
  input: Record<string, unknown>
  tags: string[]

  // Status
  status: 'pending' | 'submitted' | 'processing' | 'ready' | 'failed'
  errorCode?: string
  errorMessage?: string

  // Batch tracking
  expectedCount: number
  receivedOutputs: ReceivedOutput[]  // Accumulated from webhooks

  // Raw payloads
  rawRequest?: unknown
  rawResponse?: unknown

  // Timestamps
  createdAt: number
  submittedAt?: number
  completedAt?: number
}

interface ReceivedOutput {
  index: number
  taskUUID: string
  contentType: string
  data: ArrayBuffer
  cost?: number
  seed?: number
  metadata: Record<string, unknown>
  rawWebhook: unknown
  receivedAt: number
}
```

### DO Lifecycle

```
1. CREATE
   ├─ Worker receives POST /api/generations
   ├─ Generates UUIDv7 ID
   ├─ Gets DO stub by ID
   └─ Calls DO.init(request)

2. INIT (in DO)
   ├─ Parse and validate input
   ├─ Determine expectedCount from input.numberResults
   ├─ Build Runware payload
   ├─ Store rawRequest
   ├─ Submit to Runware API
   ├─ Store rawResponse
   ├─ Update status: pending → submitted
   ├─ Persist state to DO storage
   └─ Return { id, slug, status }

3. WEBHOOK (in DO, per callback)
   ├─ Parse webhook payload
   ├─ Check for errors → fail() if error
   ├─ For each data item:
   │   ├─ Dedupe by taskUUID (idempotency)
   │   ├─ Fetch image from URL or decode base64
   │   ├─ Add to receivedOutputs with rawWebhook
   │   └─ Broadcast progress to WebSocket clients
   ├─ If receivedOutputs.length >= expectedCount:
   │   └─ complete()
   └─ Persist state

4. COMPLETE (in DO)
   ├─ For each output:
   │   └─ PUT to R2: outputs/{generation_id}/{index}
   ├─ Write generation record to D1
   ├─ Write output records to D1
   ├─ Update status: processing → ready
   ├─ Broadcast completion to WebSocket clients
   └─ Schedule cleanup alarm

5. HIBERNATION
   ├─ After completion, DO can hibernate
   ├─ WebSocket connections maintained via hibernation API
   └─ State persisted, memory released
```

### WebSocket Protocol

```typescript
// Client → Server
type ClientMessage =
  | { type: 'subscribe' }         // Request current state
  | { type: 'ping' }

// Server → Client
type ServerMessage =
  | { type: 'state', state: PublicGenerationState }
  | { type: 'progress', received: number, expected: number }
  | { type: 'output', index: number, contentType: string }  // Binary follows
  | { type: 'complete', outputCount: number }
  | { type: 'error', code: string, message: string }
  | { type: 'pong' }
```

## API Design

### REST/RPC Endpoints

#### Create Generation

```
POST /api/generations

Request:
{
  "model": "civitai:108@1",
  "input": {
    "positivePrompt": "a serene mountain landscape",
    "width": 1024,
    "height": 1024,
    "numberResults": 4,
    "outputFormat": "WEBP"
  },
  "tags": ["landscape", "test"],
  "slug": "mountain-test"
}

Response:
{
  "id": "01HQXY...",
  "slug": "01HQXY12-mountain-test",
  "status": "submitted",
  "expectedCount": 4
}
```

**Input handling:**
- `taskType` defaults to `imageInference` if not specified
- `numberResults` determines `expectedCount`
- `includeCost` defaults to `true`
- Dimensions default to 1024x1024 if not specified
- Everything else passes through to Runware unchanged

#### Get Generation

```
GET /api/generations/:id

Response:
{
  "id": "01HQXY...",
  "slug": "01HQXY12-mountain-test",
  "status": "ready",
  "model": "civitai:108@1",
  "taskType": "imageInference",
  "input": { ... },
  "tags": ["landscape", "test"],
  "expectedCount": 4,
  "outputs": [
    {
      "index": 0,
      "contentType": "image/webp",
      "url": "/files/01HQXY.../0",
      "cost": 0.0012,
      "seed": 12345
    },
    ...
  ],
  "createdAt": "2024-01-15T10:30:00Z",
  "completedAt": "2024-01-15T10:30:15Z"
}
```

#### List Generations

```
GET /api/generations?status=ready&limit=20&cursor=...

Response:
{
  "items": [...],
  "nextCursor": "..."
}
```

#### Get Output File

```
GET /files/:generationId/:index

Response: Binary data with appropriate Content-Type
```

### Execution Modes

The API supports three execution patterns:

#### 1. Fire and Forget (Default)

```typescript
const { id } = await api.generations.create({ ... })
// Returns immediately after submission
// Poll or use WebSocket for completion
```

#### 2. Wait for Completion

```typescript
const result = await api.generations.create({
  ...input,
  wait: true,      // Hold connection until complete
  timeout: 60000   // Max wait (default 60s, max 55s due to CF limits)
})
// Returns with outputs populated
```

Implementation: DO uses long-polling internally, checking state every 500ms until complete or timeout.

#### 3. WebSocket Stream

```typescript
const { id } = await api.generations.create({ ... })
const ws = new WebSocket(`wss://api.example.com/generations/${id}/stream`)

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data)
  if (msg.type === 'progress') {
    console.log(`${msg.received}/${msg.expected} ready`)
  }
  if (msg.type === 'complete') {
    ws.close()
  }
}
```

## Runware Integration

### Request Flow

```typescript
// 1. Build payload
const payload = [
  { taskType: 'authentication', apiKey: env.RUNWARE_KEY },
  {
    taskType: input.taskType ?? 'imageInference',
    taskUUID: generationId,  // Our ID is Runware's taskUUID
    model: request.model,
    webhookURL: `${env.PUBLIC_URL}/webhooks/runware?id=${generationId}`,
    includeCost: true,
    ...input
  }
]

// 2. Store raw request
state.rawRequest = payload

// 3. Submit
const response = await fetch('https://api.runware.ai/v1', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload)
})

// 4. Store raw response
state.rawResponse = await response.json()
```

### Webhook Handling

```typescript
// Webhook URL: /webhooks/runware?id={generationId}
async function handleWebhook(request: Request) {
  const id = new URL(request.url).searchParams.get('id')
  const payload = await request.json()

  // Route to DO
  const stub = env.GENERATION_MANAGER.get(
    env.GENERATION_MANAGER.idFromString(id)
  )

  return stub.fetch(new Request('http://do/webhook', {
    method: 'POST',
    body: JSON.stringify(payload)
  }))
}
```

### Supported Task Types

Runware offers multiple task types. Our system supports all of them via the flexible input JSON:

| Task Type | Description | Key Parameters |
|-----------|-------------|----------------|
| `imageInference` | Text-to-image | positivePrompt, model, width, height |
| `controlNet` | Guided generation | guideImage, preprocessor, weight |
| `inpainting` | Edit regions | seedImage, maskImage |
| `imageUpscale` | Enhance resolution | inputImage, upscaleFactor |
| `imageBackgroundRemoval` | Remove background | inputImage |
| `photoMaker` | Face-consistent | inputImages, style |

No schema changes needed to support new task types. Just pass the appropriate `taskType` and parameters in `input`.

## Storage Strategy

### R2 Organization

```
outputs/
  {generation_id}/
    0           # First output
    1           # Second output (if batch)
    ...
```

**Why not `generations/{id}` like current system?**

The new schema treats outputs as first-class entities. Organizing by `outputs/{gen_id}/{index}` makes the relationship clear and enables efficient prefix listing if needed.

### R2 Metadata

Each object includes HTTP metadata:
```typescript
await r2.put(`outputs/${generationId}/${index}`, data, {
  httpMetadata: {
    contentType: output.contentType,
    cacheControl: 'public, max-age=31536000'  // Immutable
  },
  customMetadata: {
    generationId,
    index: String(index),
    taskUUID: output.taskUUID
  }
})
```

## Error Handling

### Error Categories

1. **Submission errors**: Runware API rejects the request
   - Store error in `raw_response`
   - Set status to `failed`, populate error fields
   - No DO persistence needed

2. **Webhook errors**: Runware reports failure via webhook
   - Store error webhook in `raw_webhook`
   - Set status to `failed`
   - Persist for debugging

3. **Partial failures**: Some outputs fail in a batch
   - Each output has its own success/failure status
   - Generation completes with partial results
   - Failed outputs have null `r2_key` and populated error fields

4. **Timeout**: Expected outputs never arrive
   - DO alarm after 5 minutes of inactivity
   - Mark as failed with `TIMEOUT` error code
   - Store whatever outputs were received

### Error Response Format

```typescript
{
  "id": "01HQXY...",
  "status": "failed",
  "error": {
    "code": "RUNWARE_ERROR",
    "message": "Invalid model identifier"
  },
  "rawResponse": { ... }  // Full response for debugging
}
```

## Migration Strategy

Since we're deploying as a separate instance with no backwards compatibility concerns:

1. **Deploy new stack**: New D1 database, new R2 bucket, new domain
2. **Parallel operation**: Both systems run independently
3. **Consumer migration**: Update consumers one at a time
4. **Sunset old system**: After all consumers migrated

## Configuration

### Environment Variables

```typescript
interface Env {
  // Runware
  RUNWARE_KEY: string

  // Public URL for webhooks
  PUBLIC_URL: string

  // Auth
  API_KEY: string

  // Bindings (Alchemy-managed)
  DB: D1Database
  BUCKET: R2Bucket
  GENERATION_MANAGER: DurableObjectNamespace
}
```

### Alchemy Infrastructure

```typescript
// packages/infra/alchemy.run.ts
import { D1Database, R2Bucket, Worker, DurableObjectNamespace } from 'alchemy/cloudflare'

const db = await D1Database('ig-db')
const bucket = await R2Bucket('ig-outputs')
const generationManager = await DurableObjectNamespace('generation-manager', {
  className: 'GenerationManager',
})

const server = await Worker('ig-server', {
  entrypoint: './apps/server/src/index.ts',
  bindings: {
    DB: db,
    BUCKET: bucket,
    GENERATION_MANAGER: generationManager,
    RUNWARE_KEY: alchemy.secret('RUNWARE_KEY'),
    API_KEY: alchemy.secret('API_KEY'),
    PUBLIC_URL: `https://ig-${stage}.example.com`,
  },
})
```

## What We're Keeping

| Component | Status | Notes |
|-----------|--------|-------|
| R2 storage | Keep | Works well, just reorganizing keys |
| D1 database | Keep | New schema, same tech |
| Hono + oRPC | Keep | Solid foundation |
| UUIDv7 IDs | Keep | Chronological ordering is useful |
| Tags system | Keep | Flexible organization works |
| Slug system | Keep | Human-readable URLs valuable |
| Service layer pattern | Keep | Clean separation of concerns |

## What We're Dropping

| Component | Status | Notes |
|-----------|--------|-------|
| fal.ai provider | Drop | Replaced by Runware-only |
| Provider abstraction | Drop | No need with single provider |
| models table | Drop | Was fal-specific |
| presets table | TBD | Could keep for convenience |
| Batch tags | Drop | Replaced by outputs table |
| Direct webhook handler | Drop | Routed through DO |

## What's New

| Component | Status | Notes |
|-----------|--------|-------|
| Generation Manager DO | New | Core coordination primitive |
| outputs table | New | Clean 1:N relationship |
| Raw request/response capture | New | Full audit trail |
| WebSocket streaming | New | Real-time updates |
| Wait mode | New | Sync completion option |

## Open Questions

1. **Presets**: Keep the presets table for storing common configurations? Or handle in consuming apps?

2. **Auto aspect ratio**: The current system has a smart aspect ratio feature using Claude. Keep it? It's Runware-compatible.

3. **R2 lifecycle**: Should we set object expiration for failed generations? Or keep everything?

4. **Rate limiting**: Add rate limiting at the API layer? Currently trusting consumers.

5. **Metrics**: Add structured logging for cost tracking, latency metrics? Currently just console.log.

## Implementation Plan

### Phase 1: Core Infrastructure

1. Set up new D1 database with schema
2. Configure R2 bucket
3. Create Generation Manager DO class
4. Basic init → submit → webhook → complete flow
5. No WebSocket yet, just HTTP

### Phase 2: API Layer

1. Create generations endpoint
2. Get generation endpoint
3. List generations endpoint
4. File serving endpoint
5. Wait mode for create

### Phase 3: WebSocket Support

1. Add WebSocket upgrade handling in worker
2. Implement hibernation in DO
3. Progress and completion broadcasts
4. Client connection management

### Phase 4: Polish

1. Auto aspect ratio (if keeping)
2. Update/delete endpoints
3. Admin endpoints (list tags, etc.)
4. Structured logging

### Phase 5: Consumer Migration

1. Update ig-console
2. Test thoroughly
3. Document changes
4. Sunset old system

## Conclusion

This redesign simplifies the system significantly:
- One provider instead of two
- Clean schema that matches our actual data model
- Durable Objects solve the batch problem elegantly
- Raw payload capture enables debugging
- Real-time updates for better UX

The complexity reduction from dropping fal and the provider abstraction layer far outweighs the migration effort. The result is a focused, maintainable system that does one thing well: orchestrate Runware inference and store artifacts.
