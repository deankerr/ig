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
│  Responsibilities:                                                  │
│  - Input validation and normalization (Zod schemas)                 │
│  - Create generation record in D1 (status: pending)                 │
│  - Route to DO for async coordination                               │
│                                                                      │
│  Routes:                                                            │
│  - POST /api/generations        → validate, create, submit          │
│  - GET  /api/generations/:id    → query D1                          │
│  - GET  /api/generations        → query D1                          │
│  - WS   /generations/:id/stream → upgrade to DO                     │
│  - POST /webhooks/runware       → route to DO                       │
│  - GET  /files/:id/:index       → serve from R2                     │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│              Generation Manager Durable Object                       │
│                                                                      │
│  Pure coordination - receives already-validated data:               │
│  - Builds and submits Runware payload                               │
│  - Updates D1: status='submitted', raw_request, raw_response        │
│  - Accumulates webhook callbacks                                    │
│  - Writes outputs to R2 and D1 as they arrive                       │
│  - Updates D1: status='ready' when complete                         │
│  - Broadcasts progress via WebSocket                                │
│  - Hibernates when idle                                             │
└─────────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              │               │               │
              ▼               ▼               ▼
         Runware API         D1              R2
         (inference)   (source of truth) (artifacts)
```

### Key Principle: D1 is Source of Truth

The generation record exists in D1 from the moment of creation. The DO coordinates the async webhook flow but D1 always reflects current state:

- Generation queryable immediately after creation (status: pending)
- Status updates written to D1 at each stage transition
- Outputs written to D1 as they arrive, not batched at completion
- If DO crashes, D1 record survives for debugging

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

## Input Validation and Processing

All validation and input normalization happens at the API layer **before** creating any records. The DO receives already-validated, ready-to-use data.

### Zod Schema (API Layer)

```typescript
const createGenerationSchema = z.object({
  model: z.string().min(1),
  taskType: z.enum([
    'imageInference',
    'controlNet',
    'inpainting',
    'imageUpscale',
    'imageBackgroundRemoval',
    'photoMaker',
  ]).default('imageInference'),
  input: z.record(z.unknown()).transform(input => ({
    ...input,
    // Apply defaults
    width: input.width ?? 1024,
    height: input.height ?? 1024,
    includeCost: input.includeCost ?? true,
    positivePrompt: input.positivePrompt ?? input.prompt,
  })),
  tags: tagsSchema.default([]),
  slug: slugSchema.optional(),
})
```

### Derived Values (API Layer)

After Zod validation, before creating the record:

```typescript
// Extract expectedCount from normalized input
const expectedCount = validatedInput.input.numberResults ?? 1

// Generate ID
const id = uuidv7()

// Build slug
const slug = input.slug ? `${id.slice(0, 8)}-${input.slug}` : null
```

### What the DO Receives

The DO receives a minimal, pre-validated payload:

```typescript
interface SubmitRequest {
  id: string
  model: string
  taskType: string
  input: Record<string, unknown>  // Already normalized with defaults
  expectedCount: number
  webhookUrl: string
}
```

No parsing, no validation, no defaulting in the DO. It just coordinates.

## Durable Object Design

### State Structure

The DO maintains minimal coordination state. D1 is the source of truth.

```typescript
interface GenerationDOState {
  // Identity (matches D1 record)
  id: string
  expectedCount: number

  // Coordination state (not in D1)
  receivedTaskUUIDs: Set<string>  // For deduplication

  // Transient data (written to D1/R2 as received)
  pendingOutputs: PendingOutput[]  // Buffered until written
}

interface PendingOutput {
  index: number
  taskUUID: string
  contentType: string
  data: ArrayBuffer
  cost?: number
  seed?: number
  metadata: Record<string, unknown>
  rawWebhook: unknown
}
```

Note: The DO state is intentionally minimal. Most state lives in D1.

### DO Lifecycle

```
1. CREATE (Worker - before DO involvement)
   ├─ Validate input via Zod schema
   ├─ Apply defaults, derive expectedCount
   ├─ Generate UUIDv7 ID
   ├─ INSERT into D1: status='pending', all request fields
   ├─ Return ID to client (generation now queryable)
   └─ Call DO.submit(request) asynchronously

2. SUBMIT (in DO)
   ├─ Build Runware payload (auth task + inference task)
   ├─ POST to Runware API
   ├─ UPDATE D1: status='submitted', raw_request, raw_response
   ├─ If Runware returns error:
   │   └─ UPDATE D1: status='failed', error fields
   └─ Initialize DO state (expectedCount, empty receivedTaskUUIDs)

3. WEBHOOK (in DO, per callback)
   ├─ Parse webhook payload (light validation only)
   ├─ If error webhook:
   │   ├─ UPDATE D1: status='failed', error fields
   │   └─ Broadcast error to WebSocket clients
   ├─ For each data item:
   │   ├─ Skip if taskUUID in receivedTaskUUIDs (idempotency)
   │   ├─ Add taskUUID to receivedTaskUUIDs
   │   ├─ Fetch image from URL or decode base64
   │   ├─ Determine index (receivedTaskUUIDs.size - 1)
   │   ├─ PUT to R2: outputs/{id}/{index}
   │   ├─ INSERT into D1 outputs table
   │   └─ Broadcast progress to WebSocket clients
   ├─ If receivedTaskUUIDs.size >= expectedCount:
   │   ├─ UPDATE D1: status='ready', completed_at
   │   └─ Broadcast completion
   └─ Persist DO state

4. TIMEOUT (via DO alarm)
   ├─ Triggered after 5 minutes of no webhook activity
   ├─ If receivedTaskUUIDs.size == 0:
   │   └─ UPDATE D1: status='failed', error='TIMEOUT'
   ├─ If receivedTaskUUIDs.size > 0:
   │   └─ UPDATE D1: status='ready', completed_at (partial success)
   └─ Broadcast completion/error

5. HIBERNATION
   ├─ After completion, DO can hibernate
   ├─ WebSocket connections maintained via hibernation API
   └─ Minimal state persisted to DO storage
```

### Key Differences from Original Proposal

1. **D1 record created before DO** - Generation is queryable immediately
2. **Outputs written as they arrive** - Not batched at completion
3. **DO state is minimal** - Just coordination, D1 has the data
4. **No validation in DO** - API layer handles all input processing
5. **Partial success is success** - 3 of 4 outputs = ready with 3 outputs

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

## Failure Semantics

A generation **fails** only in these cases:

1. **Submission rejected** - Runware API returns an error on the initial request
2. **Error webhook** - Runware explicitly reports the task failed
3. **Timeout with zero outputs** - No webhooks received after 5 minutes

A generation **succeeds** (status: ready) when:

- At least one output is received, regardless of `expectedCount`
- All expected outputs are received
- Timeout occurs but some outputs were received (partial success)

**Important:** If you request 4 images (`numberResults: 4`) and receive 3, that's a **successful** generation with 3 outputs. The `expectedCount` vs actual output count is informational, not a failure condition. There's no concept of a "failed output" within a successful generation.

### Error Categories

1. **Submission errors**: Runware API rejects the request
   - UPDATE D1: status='failed', raw_response contains error
   - Generation exists in D1 for debugging
   - No R2 artifacts

2. **Error webhook**: Runware reports failure via webhook
   - UPDATE D1: status='failed', error_code, error_message
   - Store error details for debugging
   - No R2 artifacts

3. **Timeout with zero outputs**: Nothing arrived
   - UPDATE D1: status='failed', error_code='TIMEOUT'
   - Generation exists in D1 for debugging
   - No R2 artifacts

4. **Timeout with partial outputs**: Some arrived, some didn't
   - UPDATE D1: status='ready', completed_at (this is a success)
   - `expectedCount: 4`, but only 3 rows in `outputs` table
   - Consumer can compare counts if they care

### Error Response Format

```typescript
// Failed generation
{
  "id": "01HQXY...",
  "status": "failed",
  "errorCode": "RUNWARE_ERROR",
  "errorMessage": "Invalid model identifier",
  "expectedCount": 4,
  "outputs": []  // Empty for failed generations
}

// Partial success (NOT a failure)
{
  "id": "01HQXY...",
  "status": "ready",
  "expectedCount": 4,
  "outputs": [
    { "index": 0, ... },
    { "index": 1, ... },
    { "index": 2, ... }
    // Only 3 outputs, but generation succeeded
  ]
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

## R2 Storage Lifecycle

**Decision: No automatic cleanup.** Keep everything.

Rationale:
- R2 storage is cheap (~$0.015/GB/month)
- Failed generations have no R2 artifacts anyway (only D1 records)
- Partial results are still valuable artifacts
- "Store everything, ask questions later" aligns with project philosophy

**Cleanup via explicit API operations:**

```typescript
// Delete a generation and its outputs
DELETE /api/generations/:id
// Deletes: D1 generation record, D1 output records, R2 objects

// Bulk cleanup (admin endpoint, if needed)
DELETE /api/generations?status=failed&before=2024-01-01
// Only deletes D1 records (failed generations have no R2 objects)
```

Consumers decide when to clean up, not the system.

## Open Questions

1. **Presets**: Keep the presets table for storing common configurations? Or handle in consuming apps?

2. **Auto aspect ratio**: The current system has a smart aspect ratio feature using Claude. Keep it? It's Runware-compatible.

3. **Rate limiting**: Add rate limiting at the API layer? Currently trusting consumers.

4. **Metrics**: Add structured logging for cost tracking, latency metrics? Currently just console.log.

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
