# Data Model: Generations

This document records the rationale behind ig's core data model and naming conventions.

## The Core Concept

A **generation** is a record of something you created (or attempted to create) via generative AI. It encompasses:

- **Provenance** - what you asked for (endpoint, input parameters, tags)
- **Process** - what happened (status, timing, fal metadata)
- **Result** - what you got (output file, content type) or why it failed

These three concerns are unified in a single record because they tell one story. The generation is the atomic unit of this system.

## Why "Generation"?

We considered several terms:

| Term         | Problem                                                                                        |
| ------------ | ---------------------------------------------------------------------------------------------- |
| **artifact** | Implies only the output file. A failed attempt has no artifact. Input params aren't artifacts. |
| **job**      | Implies transience. Users don't think "I have 500 jobs" - they think "I have 500 generations." |
| **request**  | Too low-level. Doesn't capture the result.                                                     |
| **order**    | Commercial connotation feels off for creative tooling.                                         |

**"Generation"** works because:

- "I generated an image" - describes the act
- "My generations" - describes the collection
- A generation can be pending, ready, or failed
- A generation has inputs (what you asked for) and outputs (what you got)
- Common terminology in AI tooling (Midjourney, DALL-E, etc.)

## Why a Single Table?

Traditional thinking might suggest separating "jobs" from "artifacts":

```
jobs: id, endpoint, input, status, timing...
artifacts: id, job_id, output_key, content_type...
```

We rejected this because:

1. **The relationship is always 1:1** - we enforce one output per request
2. **Failed jobs have no artifact** - creates orphan records
3. **Queries need both** - consumers always want input params with their outputs, forcing joins
4. **The "job" is transient** - the pending state is a brief moment in the record's lifetime

From VISION.md: _"Artifacts are the point. The inference job is transient plumbing."_

The generation record exists conceptually from the moment you request it. It starts pending and becomes ready (with content) or failed (with error details). The lifecycle is part of the record, not a separate concern.

## Schema

```
generations
├── id              TEXT PRIMARY KEY (UUIDv7)
├── status          TEXT ["pending", "ready", "failed"]
├── endpoint        TEXT (fal endpoint identifier)
├── input           JSON (full input parameters - provenance)
├── tags            JSON (consumer-defined organization)
├── contentType     TEXT (MIME type when ready)
├── errorCode       TEXT (error category when failed)
├── errorMessage    TEXT (error details when failed)
├── falRequestId    TEXT (fal's queue ID)
├── falOutput       JSON (full fal response - metrics, timing, etc.)
├── createdAt       INTEGER (timestamp ms)
└── completedAt     INTEGER (timestamp ms)
```

### Notable Decisions

**No `outputUrl` or `outputKey`**: The R2 storage key is deterministic (`generations/${id}`). Storing it is redundant. If we ever need to change the storage scheme, we can add a column then.

**Status values**: `pending` (not `creating`) - standard queue terminology. "Creating" implies active work; "pending" correctly indicates waiting/queued state.

**Full JSON storage for input/output**: Provenance is valuable. We store everything fal gives us. R2 is cheap. You'll want this data eventually.

**Tags as JSON array**: Flexible, no join tables, no migrations for new tag concepts. Consumers define their own organization schemes.

## API Operations

| Operation                | Description                                                      |
| ------------------------ | ---------------------------------------------------------------- |
| `generations.create`     | Submit a generation request. Returns immediately with ID.        |
| `generations.get`        | Get a generation by ID (status, input, output, everything).      |
| `generations.list`       | List generations with filtering (status, endpoint, tags).        |
| `generations.regenerate` | Create a new generation with the same inputs as an existing one. |
| `generations.delete`     | Delete a generation and its stored file.                         |
| `generations.updateTags` | Add/remove tags from a generation.                               |
| `generations.listTags`   | Get all unique tags in use.                                      |

### Why "regenerate" not "retry"?

`retry` implies "it failed, try again." But the operation works on any generation - you might regenerate a successful one to get a variation (different seed). `regenerate` captures both use cases: retry a failure, or make another like a success.

The operation creates a **new** generation with the same inputs. The original is preserved. This is correct because:

- Each generation is unique (different seed, potentially different result)
- History is valuable
- The original record should remain unchanged

## File Serving

Files are served via `GET /generations/:id/file`. This endpoint:

1. Looks up the generation
2. Verifies status is "ready"
3. Streams the file from R2
4. Sets appropriate content-type and cache headers

The R2 key is derived: `generations/${id}`. No need to store it.

## What This Enables

- **Provenance queries**: "Show me all generations that used this endpoint with these parameters"
- **Cost analysis**: falOutput contains timing/metrics for cost estimation
- **Failure analysis**: Failed generations retain full context for debugging
- **Regeneration**: Easy to retry or create variations
- **Flexible organization**: Tags let consumers build their own taxonomies

## Migration Notes

This is a breaking change from the previous `artifacts` naming:

1. Rename table `artifacts` → `generations`
2. Rename status value `creating` → `pending`
3. Remove `outputUrl` column (derive from ID)
4. Rename R2 key prefix `artifacts/` → `generations/`
5. Update all code references and API paths
6. Update admin console UI

Existing data can be migrated or cleared (pre-production, no preservation needed).
