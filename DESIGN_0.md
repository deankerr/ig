# ig - Design (v0)

A microservice for managing generative AI inference via fal.ai. Handles artifact creation, storage, and retrieval.

## Core Principles

- **Artifacts are primary**: Jobs are implementation detail. You're building a library of generated content.
- **Fal passthrough**: Input payloads are opaque. We validate shape, not content.
- **Fal orchestrates**: We submit, they queue/process/notify. No polling, no job management.
- **Store everything**: Inputs, outputs, errors, metrics. R2 is cheap.

## Stack

- Cloudflare Workers - API
- D1 - Artifact records
- R2 - Output blobs

## Data Model

```sql
CREATE TABLE artifacts (
  id TEXT PRIMARY KEY,              -- UUIDv7
  status TEXT NOT NULL,             -- creating | ready | failed
  endpoint TEXT NOT NULL,           -- fal-ai/flux-2/lora

  input JSON NOT NULL,              -- fal request payload
  tags JSON NOT NULL DEFAULT '[]',  -- string array, consumer-defined

  output_url TEXT,                  -- R2 public URL (ready only)
  content_type TEXT,                -- mime type (ready only)

  error_code TEXT,                  -- (failed only)
  error_message TEXT,               -- (failed only)

  fal_request_id TEXT,
  fal_metrics JSON,

  created_at INTEGER NOT NULL,
  completed_at INTEGER
);

CREATE INDEX idx_created ON artifacts(created_at DESC);
CREATE INDEX idx_status_created ON artifacts(status, created_at DESC);
CREATE INDEX idx_endpoint_created ON artifacts(endpoint, created_at DESC);
```

Tags queried via `json_each()` - good enough until it isn't.

## Event Flow

### Submit

```
POST /artifacts { endpoint, input, tags? }
         │
         ▼
   ┌─────────────┐
   │  Validate   │
   │   input     │
   └─────────────┘
         │
         ▼
   ┌─────────────┐
   │ Insert row  │
   │  creating   │
   └─────────────┘
         │
         ▼
   ┌─────────────┐
   │ Submit to   │
   │ fal queue   │
   └─────────────┘
         │
         ▼
   ┌─────────────┐
   │   Update    │
   │fal_request_id
   └─────────────┘
         │
         ▼
   Return { id, status: 'creating' }
```

### Receive (Webhook)

```
POST /webhooks/fal { request_id, status, payload }
         │
         ▼
   ┌─────────────┐
   │ Look up by  │
   │fal_request_id
   └─────────────┘
         │
         ├── success ──▶ Upload to R2 ──▶ Update row (ready)
         │
         └── failure ──▶ Update row (failed, error details)
```

### Query

```
GET  /artifacts           List/filter artifacts
GET  /artifacts/:id       Single artifact
POST /artifacts/:id/tags  Add tags
DELETE /artifacts/:id/tags Remove tags
DELETE /artifacts/:id     Remove artifact + R2 object
POST /artifacts/:id/retry New artifact from existing input
```

## API

### Create Artifact

```
POST /artifacts
Body: { endpoint: string, input: object, tags?: string[] }
Returns: { id, status: 'creating' }
```

### List Artifacts

```
GET /artifacts
Query:
  tags     - comma-separated, AND logic
  status   - creating | ready | failed
  endpoint - exact match
  limit    - default 50, max 100
  cursor   - opaque pagination token
Returns: { artifacts: Artifact[], cursor?: string }
```

Sorted by `created_at DESC` always.

### Get Artifact

```
GET /artifacts/:id
Returns: Artifact (full details)
```

### Manage Tags

```
POST /artifacts/:id/tags
Body: { add?: string[], remove?: string[] }
Returns: { tags: string[] }
```

### Delete Artifact

```
DELETE /artifacts/:id
Returns: { deleted: true }
```

Removes row and R2 object.

### Retry

```
POST /artifacts/:id/retry
Body: { tags?: string[] }  -- optional override
Returns: { id, status: 'creating' }
```

Creates new artifact with same endpoint/input.

### Webhook

```
POST /webhooks/fal
Body: fal webhook payload
Returns: 200 OK
```

## R2 Structure

```
artifacts/{id}    -- output blob
```

Content-type in R2 metadata. Public bucket, direct URL access.

## Not v0

- Cost tracking / usage aggregation
- Thumbnails / variants
- Batch operations
- ig-console UI
- Complex tag queries (OR, NOT)
- Artifact TTL / cleanup
