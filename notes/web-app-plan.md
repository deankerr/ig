# Web App Plan

## Architecture

Single-page app. One route (`/`), all state driven by URL search params. Three layers that stack:

```
┌─────────────────────────────────────────┐
│              Detail Modal               │  ← ?artifact={id} or ?generation={id}
│         (on top of everything)          │
├────────────────────┬────────────────────┤
│                    │   Craft Bench      │  ← sheet/panel, pinned right on desktop
│   Main Content     │   (maintains state │
│   (list view)      │    when closed)    │
│                    │                    │
└────────────────────┴────────────────────┘
```

**URL params drive everything:**

- `?view=artifacts` (default) or `?view=generations` — which list is showing
- `?artifact={id}` — opens artifact detail modal
- `?generation={id}` — opens generation detail modal
- Craft bench open/pinned state is local (not URL — no reason to share it)

## Main Content: The List

Two modes toggled by `?view=` param, sharing the same layout slot:

### Artifacts (`?view=artifacts`, default)

- Grid or list toggle (local preference, persisted)
- **Grid mode**: uniform thumbnail cells, no metadata visible
- **List mode**: small thumbnail + model, prompt snippet, timestamp, seed
- Thumbnails via `/art/{slug}?w=256&f=webp`
- Infinite scroll, newest first
- Click thumbnail → `?artifact={id}` (opens modal)
- Filters: none in v1, just recency

### Generations (`?view=generations`)

- Always list-style layout
- Each generation row shows:
  - Small grid of batch artifact thumbnails (inline, wrapping)
  - Status indicator (pending / complete / error)
  - Model, prompt snippet, timestamp, artifact count
- Click artifact thumbnail → `?artifact={id}`
- Click generation row (non-thumbnail area) → `?generation={id}`
- In-flight generations show skeleton thumbnails, auto-poll

## Craft Bench

A **sheet** that slides in from the right. Can be:

- **Closed** — hidden, but state preserved (textarea content, in-flight generations)
- **Open as sheet** — overlay on top of main content, dismissible
- **Pinned** — docked to right side, main content shrinks. Default on desktop.

**Contents:**

- JSON textarea (persisted to localStorage)
- "Send" button → calls `createImage`
- Recent submissions feed below input — just this session's generations with status
- "Send to Craft Bench" from a modal populates the textarea and opens the bench

The bench is NOT a route. It's a persistent UI element with local state. Opening/closing it doesn't change the URL.

## Detail Modal

Opened by `?artifact={id}` or `?generation={id}`. Overlays everything (including pinned bench).

### Artifact Modal

- Large image preview
- Generation input params (prompt, model, dimensions, steps, CFG, seed, etc.)
- Timing: created, completed, duration
- Cost (if available)
- Batch siblings — thumbnail strip of other artifacts from same generation
- "Send to Craft Bench" — copies generation input to bench textarea, opens bench
- Download / link to original

### Generation Modal

- Similar to artifact modal but generation-centric
- Shows all artifacts in the batch as a grid
- Shows request-level error if present
- Per-output errors shown on individual artifacts
- Generation input params, timing, status
- "Send to Craft Bench" with the generation's input

Both modals share most of their rendering — the difference is which data is primary and what's fetched.

## Server Endpoints

New oRPC query procedures:

| Procedure         | Input                 | Returns                                                       |
| ----------------- | --------------------- | ------------------------------------------------------------- |
| `listArtifacts`   | `{ cursor?, limit? }` | `{ items: Artifact[], nextCursor? }`                          |
| `listGenerations` | `{ cursor?, limit? }` | `{ items: GenerationSummary[], nextCursor? }`                 |
| `getGeneration`   | `{ id }`              | `Generation & { artifacts: Artifact[] }`                      |
| `getArtifact`     | `{ id }`              | `Artifact & { generation: Generation, siblings: Artifact[] }` |

Cursor-based pagination (createdAt + id for stability).

`GenerationSummary` includes inline artifact previews (IDs, slugs, content types) so the generation list doesn't need N+1 queries.

## Components

### Core

| Component           | Purpose                                                                          |
| ------------------- | -------------------------------------------------------------------------------- |
| `ArtifactThumbnail` | Image thumbnail. Loading skeleton, error state. Accepts slug + transforms.       |
| `ArtifactListItem`  | List-mode row: small thumbnail + metadata (model, prompt, time, seed).           |
| `GenerationRow`     | Generation list row: inline artifact grid, status, model, prompt, time, count.   |
| `DetailModal`       | Shared modal shell. Artifact or generation detail content. Batch siblings strip. |
| `JsonEditor`        | Textarea with JSON validation indicator. Send button.                            |
| `StatusBadge`       | Pill showing generation state: pending, complete, partial, error.                |

### Layout

| Component       | Purpose                                                                     |
| --------------- | --------------------------------------------------------------------------- |
| `AppShell`      | Top bar (view toggle, bench toggle) + main content area + bench panel slot. |
| `CraftBench`    | The sheet/panel. Manages its own open/pinned/closed state.                  |
| `ViewToggle`    | Artifacts / Generations tab switch.                                         |
| `DisplayToggle` | Grid / List switch (artifacts view only).                                   |

### Shared

| Component  | Purpose             |
| ---------- | ------------------- |
| `TimeAgo`  | Relative timestamp. |
| `Copyable` | Click-to-copy text. |

## Queries (TanStack Query)

| Key                       | Endpoint          | Notes                                             |
| ------------------------- | ----------------- | ------------------------------------------------- |
| `['artifacts', cursor]`   | `listArtifacts`   | Infinite query, feed                              |
| `['generations', cursor]` | `listGenerations` | Infinite query, generation list                   |
| `['generation', id]`      | `getGeneration`   | Modal detail                                      |
| `['artifact', id]`        | `getArtifact`     | Modal detail (with siblings)                      |
| `['status', id]`          | `getStatus`       | Polling, refetchInterval 3s, stops on completedAt |

## Client State

- **URL params**: view mode, open modal (artifact/generation ID)
- **localStorage**: craft bench textarea content, display preference (grid/list)
- **React state**: craft bench open/pinned, in-flight generation IDs (for polling)
- **TanStack Query**: all server data

No state management library needed.

## File Structure

```
apps/web/src/
  routes/
    __root.tsx          # AppShell layout
    index.tsx           # Main list view (reads ?view= param)
  components/
    app-shell.tsx
    craft-bench.tsx
    detail-modal.tsx
    artifact-thumbnail.tsx
    artifact-list-item.tsx
    generation-row.tsx
    json-editor.tsx
    status-badge.tsx
    view-toggle.tsx
    display-toggle.tsx
    time-ago.tsx
    copyable.tsx
  queries/
    artifacts.ts
    generations.ts
    inference.ts
  lib/
    orpc.ts
    utils.ts
```

## Key Interactions

1. **Browse**: Land on `/`, see artifact grid. Scroll. Click → modal.
2. **Switch view**: Click "Generations" tab → same page, generation list loads.
3. **Open bench**: Click bench toggle → sheet slides in from right. Type JSON, send.
4. **Pin bench**: Click pin → sheet docks, content area shrinks.
5. **Generation completes**: Skeleton thumbnails in bench feed fill in. Also appears in main list on next scroll/refetch.
6. **Remix**: In artifact modal → "Send to Craft Bench" → bench opens with input populated.
7. **Batch navigation**: In artifact modal → click sibling thumbnail → modal updates (param changes).

## More Things I Want

- Copy to clipboard hook. Use sonner for feedback
