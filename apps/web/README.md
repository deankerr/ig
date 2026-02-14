# ig console

Developer admin UI for browsing artifacts and generations produced by the ig inference service.

## Views

Single-page app with two main views, switchable via tabs in the header. URL search params drive all navigation — no nested routes.

### Artifacts (`?view=artifacts`)

Paginated list of generated artifacts (images). Supports grid and list display modes (persisted to localStorage). List mode shows model, seed, duration, and relative timestamp. Infinite scroll for pagination.

### Generations (`?view=generations`)

Paginated list of inference generations. Each row shows model, artifact count, duration, prompt snippet, and thumbnail strip. Links to the generation inspector for full detail.

### Inspector (`?artifact={id}` or `?generation={id}`)

Modal overlay for detailed inspection of a single artifact or generation. Opened by clicking any item in the lists.

- **Artifact inspector**: full-size image preview, sibling strip, metadata sidebar (model, seed, cost, duration), generation input JSON. Actions: open in new tab, download, copy URL, send input to craft bench, view JSON, view DO request state.
- **Generation inspector**: artifact grid, metadata sidebar, generation input. Actions: send to bench, view JSON, view DO request state.

### Craft Bench

Side panel for submitting inference requests. Toggle via header button. Renders as a fixed sidebar on wide viewports (>=1024px), sheet overlay on narrow viewports.

- JSON textarea for request input (persisted to localStorage)
- In-flight generation tracking with status polling
- "Send to bench" from inspectors pre-fills the input

## Queries

All data fetching via oRPC + TanStack Query. Query cache persisted to localStorage (24h gc, 5min stale).

| Query             | File                     | Description                                           |
| ----------------- | ------------------------ | ----------------------------------------------------- |
| `listArtifacts`   | `queries/artifacts.ts`   | Infinite paginated artifacts with generation duration |
| `getArtifact`     | `queries/artifacts.ts`   | Single artifact + generation + siblings               |
| `listGenerations` | `queries/generations.ts` | Infinite paginated generations with artifacts         |
| `getGeneration`   | `queries/generations.ts` | Single generation + all artifacts                     |
| `getStatus`       | `queries/inference.ts`   | DO request state polling (3s interval until complete) |
| `createImage`     | `queries/inference.ts`   | Submit inference request mutation                     |
| `healthCheck`     | `queries/health.ts`      | Server health polling (30s)                           |

## State Management

Three React Context providers, all in the router's `Wrap` component (`main.tsx`):

| Provider            | Location                                     | Purpose                                                                                                                               |
| ------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `JsonSheetProvider` | `components/shared/json-sheet.tsx`           | App-level JSON viewer sheet. Any component calls `useJsonSheet().open(data, title)`. Renders above all modals with proper z-stacking. |
| `BenchProvider`     | `components/bench-provider.tsx`              | Craft bench open/close state and in-flight generation IDs. Consumed by `AppShell` (layout) and `CraftBench` (UI).                     |
| `InspectorProvider` | `components/inspector/inspector-context.tsx` | Per-modal context for close, copy, send-to-bench actions. Scoped to each inspector modal instance.                                    |

## Auth

API key stored in localStorage. Required for mutations (submit inference). Set via the key icon button in the header. Sent as `x-api-key` header on all RPC requests when present.
