# Redesign: Delivery Strategy & Schema

Status: **In progress** — capturing discoveries and direction, not all decisions final.

## Context

Dropping fal, going Runware-only. Runware gives us access to the full generative image/video ecosystem with a standard API, cheaper.

Using Durable Objects for advanced use cases (real-time, batch aggregation) — decided, but not part of the first iteration.

## Delivery: ig <-> Runware

### What Runware offers

| Method                     | How it works                                              | Batch support                          |
| -------------------------- | --------------------------------------------------------- | -------------------------------------- |
| Sync + URL                 | Request, get `imageURL` in response                       | Yes, array of results                  |
| Sync + binary              | Request with `outputFormat: base64Data/dataURI`           | Yes                                    |
| Webhook + URL/binary       | Dispatch, callback with result. Batch = separate webhooks | Yes (N webhooks)                       |
| `uploadEndpoint`           | Runware PUTs binary to a presigned URL                    | **No** — single URL, clobbers on batch |
| `uploadEndpoint` + webhook | Binary to bucket, metadata via webhook                    | Same limitation                        |

### Key discovery: uploadEndpoint timing

**Tested and confirmed:** Runware returns the sync response (or fires the webhook) _before_ the upload to `uploadEndpoint` completes. The upload is a background task on their end. This creates a race condition if you try to check the bucket on webhook receipt.

Timeline:

```
Runware generates image
  → immediately returns metadata (sync response or webhook)
  → starts background upload to uploadEndpoint
  → upload completes seconds later
```

### Key discovery: uploadEndpoint + batch

With `numberResults > 1` and a single `uploadEndpoint`, only one file ends up in the bucket. The results clobber each other or only the last one lands. **Batch is incompatible with `uploadEndpoint`.**

### Chosen strategy: stream + tee

Instead of `uploadEndpoint`, we stream the image from Runware's CDN URL (`imageURL`) and tee the stream into R2 ourselves. Benefits:

- We control the timing — R2 write happens as part of our flow
- Works identically for single and batch (we handle fan-out)
- Client can get the image URL sooner
- No presigned URL machinery needed

**We don't send batch requests to Runware.** If the user wants 4 images, we make 4 individual requests. We control the fan-out, each request is independent. An output failing doesn't kill the batch.

### Delivery by task type

| Task         | Runware delivery            | ig handling                                      |
| ------------ | --------------------------- | ------------------------------------------------ |
| Single image | Sync, get `imageURL`        | Stream from URL, tee to R2, complete immediately |
| Batch images | N × single image            | Fan out N requests, each streams independently   |
| Video        | Async (required by Runware) | Webhook for completion, then stream + tee        |
| Audio        | Sync possible but slow      | TBD — sync for short, webhook for long?          |

## Delivery: client <-> ig

### Principles

- Clients only get URLs, never binary. ig hosts the data.
- For simple scripts/bots, getting the result in one call is strongly preferred over polling.
- Async is the universal fallback — works for everything.

### Strategy

- **Single image:** ig holds the client connection, streams from Runware, tees to R2, returns the completed generation with URL. One call, one result.
- **Batch:** Return generation ID immediately. Outputs complete independently. Client polls or subscribes.
- **Video/audio:** Return generation ID immediately. Async by nature.
- Future: WebSocket or SSE for real-time updates on batch/async jobs.

## Schema: Generation vs Output

### Problem with current schema

The `generations` table conflates "request" and "result" into one record. Batch outputs create extra generation records with `batch:{id}` tags. Tags are a JSON column on the generation, but conceptually some tags belong to the request and some to individual outputs.

### Proposed separation

**Generation** = the request. "I asked for 4 images with these inputs."

- Persisted before any work starts
- Tracks: model, input, requested count, aggregate status
- Status: `pending` → `partial` → `ready` / `failed`
- Tags on a generation describe the _request_: `project:discord-bot`, `session:abc`

**Output** = an individual result. "Here is one image that came back."

- Belongs to a generation (FK)
- Has its own lifecycle — can be deleted, upscaled, tagged independently
- Tracks: content type, R2 key, provider metadata (cost, seed), error info
- Status: `pending` → `ready` / `failed`
- Tags on an output describe the _result_: `favorite`, `collection:landscapes`, `botched`

### Tags as a junction table

Separate table, can point at any entity. No JSON column.

```sql
tags
  tag             text
  target_type     text          -- 'generation' | 'output' | future types
  target_id       text

  PK (tag, target_type, target_id)
  index (target_type, target_id)  -- "all tags for this thing"
  index (tag)                     -- "everything with this tag"
```

Adding a new taggable entity (collections, presets) is just a new `target_type` value. No schema change.

### Schema sketch

```sql
generations
  id              text PK           -- UUIDv7
  status          text              -- pending, partial, ready, failed
  provider        text              -- 'runware'
  model           text
  input           json              -- request payload
  count           integer           -- requested number of outputs
  slug            text UNIQUE
  created_at      integer
  completed_at    integer

outputs
  id              text PK           -- UUIDv7
  generation_id   text FK → generations
  status          text              -- pending, ready, failed
  content_type    text
  error_code      text
  error_message   text
  provider_metadata json            -- cost, seed, imageUUID, etc.
  created_at      integer
  completed_at    integer

tags
  tag             text
  target_type     text
  target_id       text
  PK (tag, target_type, target_id)
```

R2 key: `outputs/{output_id}` (not `generations/{id}`).

## Open questions

- **Generation-level metadata** — where does preprocessing info go (e.g., auto-aspect-ratio result)? On the generation record? Separate metadata table?
- **Slug** — lives on generation now. Do outputs need their own slugs for direct access?
- **Video/audio async flow** — webhook-based, but details TBD. How do we know when to stream + tee vs wait for webhook?
- **Count tracking** — generation knows expected count. How do we update `partial` → `ready`? On each output completion, check count?
- **Deletion semantics** — delete an output = delete R2 object + record. Delete a generation = delete all outputs? Or just orphan them?
- **Migration** — current `generations` table has mixed request+output data. Migration path TBD. (Note: CLAUDE.md says no backwards compat needed, clean break is fine.)
- **uploadEndpoint** — keeping the presign machinery around? Or removing since we're going with stream + tee? May still be useful for video where we don't want to proxy large files.
