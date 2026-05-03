# AGENTS.md

Always read @VISION.md for a high level understanding of the project.

## Status

Experimental with low-traffic production deployment. Breaking changes are acceptable.

Local `apps/server` dev server is disabled due to issues with alchemy's dev mode. `dev:web` is configured to point at the remote dev environment, and may be used for `apps/web` changes only.

## Structure

```
apps/server/     # Hono + oRPC on Cloudflare Workers (port 3220)
apps/discord-bot/ # Discord bot consumer, uses server + generation event queue
apps/web/        # React admin console (Vite, port 3221)
packages/db/     # Drizzle ORM schema (SQLite/D1)
packages/env/    # Cloudflare binding/env helpers
packages/infra/  # Alchemy infrastructure-as-code
```

## Commands

```bash
bun run check         # type check + fix + format, use when work complete/as needed
bun run deploy        # Deploy to Cloudflare via Alchemy
```

## Features

- Organise code into directories by "feature", "service", etc.
- The exact shape is not strict and may shift over time.
- In React, this should look like `components/` sub-directories.
  - Do not place feature-level code in a 'route' file - this should be for "page" level concerns, and/or glueing major feature components together.

## API

- **REST** (`/api/*`) — Scalar docs at `/api`, OpenAPI spec at `/api/spec.json`
- **RPC** (`/rpc/*`) — oRPC endpoints (used by the web app via RPCLink)
- **Webhooks** (`/webhooks/runware`) — provider callbacks
- **Auth**: All endpoints require `x-api-key` header.
- All endpoints are POST (oRPC). REST paths mirror the router structure: `/api/generations/create`, `/api/generations/get`, etc.
- `sync:true` blocks on provider response and artifact storage. Works for fast models but can time out silently on slow ones. Prefer async create for reliability.

## Tags

Tags are flexible request context, not just user-facing labels.

- `generations.create` accepts `tags`; async inference stores them in live request state and copies them onto produced artifacts.
- Artifact tags are the persisted/searchable projection of request context. If a generation fails before producing artifacts, its tags may only exist in request state and lifecycle events.
- Tags may identify source systems, routing context, user-visible labels, slugs, or short-lived consumer state. For example, the Discord bot stores channel/user/interaction context as `discord:*` tags.
- Reading tags requires the API key. Artifact files can be public by id or slug, but public file URLs do not expose tag metadata.

### Artifact Slug URLs

The `ig:slug` tag is an optional custom path for resolving an artifact file.

- `GET /a/{slug}[.ext]` — resolves slug → artifact via tag lookup → serves R2 file
- `GET /artifacts/{id}/file` — direct access by artifact ID (no tag lookup)

## Infrastructure

Alchemy (`packages/infra/alchemy.run.ts`) defines all Cloudflare resources.

## Generation Events

Inference emits lifecycle events to the shared `generation-events` Cloudflare Queue.

- Events are server-owned domain events (`generation.submitted`, `generation.dispatched`, `artifact.created`, `generation.completed`, `generation.failed`).
- Events include request tags so consumers can route and act without polling.
- Queue publishing is best-effort from the generation's perspective: log delivery failures, but do not fail inference because an event could not be published.
- `apps/discord-bot` consumes this queue. `/imagine` submits async generations, tags them with Discord context, then the queue consumer posts completion/failure results back to Discord.

## Models

These models are fast and cost practically nothing. Use them when testing inference functionality.

- `runware:400@1` FLUX.2 dev
- `rundiffusion:120964@131579` RunDiffusionXL (SDXL)
- `civitai:4384@128713` DreamShaper (SD1.5)

Common production models:

- `bytedance:5@0` ByteDance Seedream 4
- `civitai:133005@782002` Juggernaut XL XI (SDXL)

## Remeda

Use Remeda to write clean, functional code.

- `import * as R from 'remeda'` is convenient and properly tree-shaken.
- Excellent type narrowing makes our code safer.
- Very useful examples: `chunk`, `first`, `only`, `splitWhen`, `hasAtLeast`, `isDeepEqual`, `isDefined`, `isNullish`, `isNotNull`, `pick`, `pickBy`, `omit`, `merge`

## Reference

See @notes for Runware API schemas/docs
