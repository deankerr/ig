# Schema Design with Durable Objects

A case study in designing D1 tables alongside Durable Object storage. The process changed how we think about what goes in a database.

## Starting Point

We had a traditional `generations` table — one row per request with every field you might want: status enum, error code, error message, provider metadata, content type, tags, slug. The table was the source of truth. Everything lived there.

Then we introduced Durable Objects for generation orchestration. Each DO manages a single generation request: dispatches to the API, handles webhooks, stores outputs in R2, tracks success and failure. By the time it's done, the DO has 100% of the information about that generation.

This raised a question: if the DO already has everything, what does D1 need?

## The Three-Store Insight

We ended up with three data stores, each with a distinct role:

| Store          | Role                              | Access             |
| -------------- | --------------------------------- | ------------------ |
| DO storage     | Complete truth for one generation | By ID only         |
| D1 generations | Queryable catalog                 | Filter, sort, join |
| D1 artifacts   | Queryable gallery                 | Filter, sort       |

The crucial constraint: **DOs are addressed by ID, not queryable as a collection.** You can't ask "show me all generations" — you have to know which one you want. D1 provides the catalog view that DOs can't.

This reframing changed everything. D1 isn't the source of truth. It's an index into the DO.

## Fields Earn Their Place

Once we saw D1 as an index, the design question became: what would you put an index on?

For each candidate column, we asked: "when would I filter or sort by this?" If the answer was "practically never," it doesn't need to be a column. It belongs in a JSON field, in the DO, or nowhere.

This killed a lot of columns:

- **`error_code`, `error_message`** — you filter for "has error" (artifact_count = 0), not by specific error. The DO has the details.
- **`provider_metadata`** — display data, never filtered. Lives in the DO.
- **`content_type`** — belongs on the artifact, not the generation. And even on the artifact, you'd rarely filter by it.
- **`image_uuid`** — a Runware reference. Useful for debugging, never queried. Goes in the artifact's metadata JSON.
- **`provider_request_id`** — never queried. DO has it.

What survived: `model` (definitely filter by this), `created_at` (primary sort), `input` (provenance shown in every modal view). That's it for indexed fields.

## artifact_count Is the Status

The original table had `status: 'pending' | 'ready' | 'failed'`. We went through several iterations:

First thought: three states — `ready`, `partial`, `failed`. Easy to filter, explicit about what happened.

Then we noticed: with DOs handling in-flight state, there's no `pending` in D1. Rows only appear when the generation completes. So it's really two states: got something, or didn't.

Then the breakthrough: `artifact_count` already encodes this. Zero means failure. Greater than zero means success. The number is more informative than a string enum, and just as indexable.

```sql
-- "Show me failures"
WHERE artifact_count = 0

-- "Show me successes"
WHERE artifact_count > 0
```

No status column needed. The data speaks for itself.

We applied the same reasoning to the DO. It had `status: 'active' | 'done' | 'failed'`. But `completedAt` already tells you if it's done (set vs undefined), and `error` tells you if it failed (present vs absent). The status field was modeling information that already existed. We removed it and renamed `count` to `expectedCount` to eliminate ambiguity.

## Outputs vs Artifacts

Early on we renamed everything from "outputs" to "artifacts." Then we realized that was wrong.

The DO tracks **outputs** — the results of each inference task. An output can succeed or fail. A successful output produces an **artifact**: a file in R2 and a row in D1. A failed output is just a failed output — it never became an artifact.

This maps cleanly to the data stores:

- DO: `state.outputs` — all outputs, success and failure
- D1: `runware_artifacts` — only the successes

The `persistToD1` function is where outputs become artifacts. The naming reflects the conceptual boundary.

## D1 as a Projection

The final mental model: D1 tables are a materialized projection of the DO.

The DO is the event source — it lived through the generation. D1 captures the queryable slice. The write path is simple: when the DO finalizes, it projects. One insert to `runware_generations`, N inserts to `runware_artifacts` (one per successful output). No updates, no partial writes. Records are immutable once written.

This means the entire D1 write surface is a single function called at three points: webhook completion, timeout, or create failure.

## The Result

Two lean tables:

```
runware_generations
  id, model, input, artifact_count, created_at, completed_at

runware_artifacts
  id, generation_id, model, r2_key, content_type, seed, cost, metadata, created_at
```

Six columns on generations (was thirteen). Nine on artifacts (a new table). Every column either has an index or is essential for display. Everything else lives in the DO or in a JSON field.

## Takeaways

1. **Ask "what would I index?" for every column.** If you wouldn't index it, it might not need to be a column.
2. **Durable storage changes the equation.** When another store has the complete picture and is queryable by ID, the database becomes a catalog, not a replica.
3. **Numbers can replace enums.** `artifact_count = 0` is a failure. `completedAt != null` means done. Let the data model the state instead of adding a parallel status field.
4. **Name things for what they are at that layer.** DO tracks outputs (some fail). D1 stores artifacts (only successes). The projection boundary is where the transformation happens.
