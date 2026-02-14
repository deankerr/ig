# DO-Era Schema Design

How the D1 tables work alongside Durable Object storage. Outcome of a design conversation, not a strict spec.

## Three Stores

The DO architecture introduces a third data store. Each has a distinct role:

| Store              | Role                            | Access                          |
| ------------------ | ------------------------------- | ------------------------------- |
| **DO storage**     | Complete truth for a generation | By ID only. Permanent. Free.    |
| **D1 generations** | Queryable catalog of requests   | Filter, sort, join              |
| **D1 artifacts**   | Queryable gallery of outputs    | Filter, sort — the primary feed |

The DO is the authority. It has 100% of the information: request params, every output (success or failure), error details, timing, raw provider responses. D1 is the _index into it_ — just enough structure to power feeds, filters, and list views.

For one-off lookups ("what exactly happened with this generation?"), hit the DO directly. A frontend can cache DO responses for recent generations.

## Design Principle: Fields Earn Their Place

A column in D1 exists because you'd put an index on it. If the answer to "when would I filter or sort by this?" is "practically never," it belongs in a JSON column, in the DO, or nowhere.

This keeps D1 lean and purposeful. It's a catalog, not a replica.

## Query Patterns

From `views_concepts.md` — two primary views drive the schema:

**Home Page Feed** (artifact-primary)

- All recent artifacts as thumbnails, newest first
- Filter by model — "show me all flux outputs"
- Click artifact → modal with generation metadata + input params

**Crafting Bench** (generation-primary)

- Recent generations, newest first
- Artifacts grouped by generation
- Error indicators for failed generations
- Click through → generation detail, optionally hit DO for full state

**Secondary**: filter by model, browse collections (tags, future), full-text prompt search (future).

## Schema

### `runware_generations`

The catalog of requests. Every completed generation gets a row — successes and failures.

```
id              text PK             -- UUIDv7, same as DO address
model           text NOT NULL       -- AIR identifier (e.g., 'civitai:108@1')
input           json NOT NULL       -- full request payload (provenance)
artifact_count  integer NOT NULL    -- 0 = failed, > 0 = produced something
created_at      integer NOT NULL    -- unix ms, when request was made
completed_at    integer NOT NULL    -- unix ms, when DO finalized
```

**Indexes:** `created_at`, `(model, created_at)`

**What's not here:**

- **No `status` enum.** `artifact_count` is the status. 0 = failed, > 0 = success. "Show me failures" is `WHERE artifact_count = 0`.
- **No `error` column.** Error details live in the DO. D1 only needs to know _that_ something failed (artifact*count = 0), not \_why*.
- **No `expected_count`.** "I asked for 4 and got 3" is a detail for the DO. No D1 query needs it. The frontend can derive it from `artifact_count` vs `input.numberResults` for display.
- **No `provider`.** Table name says Runware. Generalize later if needed.
- **No tags.** Future concern, separate design.

### `runware_artifacts`

The gallery. Successes only — if it didn't produce a file in R2, it's not an artifact.

```
id              text PK             -- UUIDv7
generation_id   text NOT NULL       -- FK -> runware_generations
model           text NOT NULL       -- denormalized, avoids join on primary feed
r2_key          text NOT NULL       -- R2 storage path
content_type    text NOT NULL       -- image/jpeg, video/mp4, audio/mp3
seed            integer             -- nullable (not all task types)
cost            real                -- nullable
metadata        json                -- raw response, provider fields, etc.
created_at      integer NOT NULL    -- unix ms, when output was received
```

**Indexes:** `created_at`, `generation_id`, `(model, created_at)`

**Design notes:**

- **`model` is denormalized.** It's tiny (a string like `civitai:108@1`) and avoids a join for the most common query: "recent artifacts, optionally filtered by model."
- **`seed` gets a column** even though it's rarely filtered. It's fundamental to image reproduction and worth surfacing directly.
- **`metadata` is the grab bag.** Raw provider response, image_uuid, anything else. Display-only data that doesn't need indexing.
- **No `image_uuid`.** Runware's reference lives in `metadata` or the DO. We don't need it for queries.

## Error Representation

Errors are a generation-level concern in D1. Three real-world scenarios:

| What happened                                 | `artifact_count` | Artifacts in D1 | Detail                          |
| --------------------------------------------- | ---------------- | --------------- | ------------------------------- |
| Request failed (HTTP, API rejection, timeout) | 0                | None            | DO has the error                |
| All outputs individually failed               | 0                | None            | DO has per-output errors        |
| Partial failure (3 of 4 succeeded)            | 3                | 3 rows          | DO has the failed output detail |

From D1's perspective, scenarios 1 and 2 are identical: `artifact_count = 0`, no artifact rows. The distinction only matters if you're debugging, and for that you go to the DO.

Partial failures are the interesting case. The generation "worked" — it produced artifacts. The frontend shows them. If the user notices they asked for 4 and got 3, they can check the DO. No special status needed in D1.

## D1 as a Projection

The D1 tables are a materialized projection of the DO. The DO is the event source — it lived through the generation, holds the full history. D1 captures the queryable slice.

The write path is simple: when the DO finalizes, it projects its state into D1. One insert to `runware_generations`, N inserts to `runware_artifacts`. That's the entire D1 write surface. No updates, no partial writes — records are immutable once written.

## What the DO Provides

When a frontend calls `DO.getState()` for a specific generation, it gets everything:

- Full request params and provider input
- Every output: successes with full metadata, failures with typed error details
- Timing: created, each output received, completed
- Raw provider responses
- The discriminated error types (http_error, api_rejected, timeout, validation, webhook_error, fetch_failed, storage_failed)

This is the "click to expand" data. D1 is the thumbnail; the DO is the full picture.

## Related

- `notes/do-architecture.md` — DO lifecycle and request flow
- `notes/views_concepts.md` — Frontend view requirements that drive this schema
- `notes/03_typed-errors-in-stateful-processes.md` — Error type design in the DO
