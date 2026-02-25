# CLAUDE.md

Always read @VISION.md for a high level understanding of the project.

## Status

Experimental with low-traffic production deployment. Breaking changes are acceptable.

## Structure

```
apps/server/     # Hono + oRPC on Cloudflare Workers (port 3220)
apps/web/        # React admin console (Vite, port 3221)
packages/db/     # Drizzle ORM schema (SQLite/D1)
packages/env/    # Cloudflare binding types (manual Env declaration)
packages/infra/  # Alchemy infrastructure-as-code
```

## Commands

```bash
bun run dev           # Start server via Alchemy
bun run check         # check-types + lint + format (with auto-fix)
bun run clean         # Remove node_modules, build artifacts, caches
bun run db:generate   # Generate Drizzle migrations
bun run deploy        # Deploy to Cloudflare via Alchemy
```

## Workflow

- Run `bun run check` to verify your work.
- Do not deploy unless specifically asked.
- LSP diagnostics are often stale in this project - `bun run check` is the source of truth.

### Graphite (stacked PRs)

Use the Graphite CLI for all branch/PR operations — not raw git branching or `gh pr create`.

```bash
gt create -am "commit message"   # Stage all + create branch + commit
gt modify -a                     # Amend staged changes to current branch
gt submit                        # Push + create/update PRs (current + downstack)
gt ss                            # Push + create/update entire stack
gt sync                          # Pull trunk, clean merged branches, restack
```

Each branch = one commit. `gt create` makes the branch, `gt submit` makes the PR.

## Features

- Organise code into directories by "feature", "service", etc.
- The exact shape is not strict and may shift over time.
- In React, this should look like `components/` sub-directories.
  - Do not place feature-level code in a 'route' file - this should be for "page" level concerns, and/or glueing major feature components together.

## Stack

- **Backend**: Hono, oRPC (type-safe RPC with OpenAPI)
- **Frontend**: React, TanStack Router + Query, Vite, shadcn/ui (Base UI)
- **Database**: SQLite via D1, Drizzle ORM
- **Storage**: Cloudflare R2
- **AI Providers**: Runware (queue-based async with webhooks)
- **Infra**: Alchemy (TypeScript IaC for Cloudflare), Durable Objects
- **Tooling**: Turborepo, Bun, Oxlint, Oxfmt

## Env Types

The global `Env` interface is declared manually in `packages/env/src/env.d.ts`. **Do not** use Alchemy's inferred `typeof server.Env` — its `Bound<T>` conditional type chain triggers TS2589 (excessively deep type instantiation). When adding a binding in `packages/infra/alchemy.run.ts`, add the corresponding property to `env.d.ts` using the Cloudflare runtime type (`D1Database`, `R2Bucket`, `DurableObjectNamespace`, etc).

## API

- **REST** (`/api/*`) — Scalar docs at `/api`, OpenAPI spec at `/api/spec.json`
- **RPC** (`/rpc/*`) — oRPC endpoints (used by the web app via RPCLink)
- **Webhooks** (`/webhooks/runware`) — provider callbacks
- **Auth**: All endpoints require `x-api-key` header.

### Curling the server

```bash
source .env; curl -s -X POST "${DEV_SERVER_URL}/api/generations/create" \
  -H "Content-Type: application/json" -H "x-api-key: ${API_KEY}" \
  -d '{"model":"civitai:4384@128713","positivePrompt":"a cat","sync":true}'
```

### Artifact Slug URLs

Artifacts can have human-readable URLs via the tag system. A slug is stored as a tag with key `ig:slug` in the `tags` junction table — not as a column on `artifacts`.

**Format:** `{uuid-prefix}-{slugified-text}` where the prefix is the first 12 hex chars of the artifact's UUIDv7 ID (~1ms timestamp resolution, prevents collisions).

**Routes:**

- `GET /a/{slug}[.ext]` — resolves slug → artifact via tag lookup → serves R2 file
- `GET /artifacts/{id}/file` — direct access by artifact ID (no tag lookup)

**Flow:** Consumer passes `tags: { "ig:slug": "my description" }` when creating a generation. The server normalizes it to `{uuid-prefix}-my-description` via `normalizeTagValues()` in `routers/utils.ts`, then persists it with `upsertTags()`.

**Key files:** `apps/server/src/routes/file.ts` (routing), `apps/server/src/routers/utils.ts` (slug normalization + tag persistence).

## Database

Schema in `packages/db/src/schema/`. Migrations in `packages/db/src/migrations/`.

- Run `bun run db:generate` after schema changes
- Migrations applied automatically by Alchemy on deploy

## Infrastructure

Alchemy (`packages/infra/alchemy.run.ts`) defines all Cloudflare resources.

## Models

These models are fast and cost practically nothing. Use them when testing inference functionality.

- `runware:400@1` FLUX.2 dev
- `rundiffusion:120964@131579` RunDiffusionXL (SDXL)
- `civitai:4384@128713` DreamShaper (SD1.5)

## Reference

See @notes for Runware API schemas/docs
