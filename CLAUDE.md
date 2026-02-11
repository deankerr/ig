# CLAUDE.md

Always read @VISION.md for a high level understanding of the project.

## Structure

```
apps/server/     # Hono + oRPC on Cloudflare Workers (port 3220)
packages/db/     # Drizzle ORM schema (SQLite/D1)
packages/env/    # Cloudflare binding types (manual Env declaration)
packages/infra/  # Alchemy infrastructure-as-code
```

See `apps/server/CLAUDE.md` for server patterns and `apps/server/src/inference/CLAUDE.md` for the inference request system.

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
- Webhooks require a public URL, so local development uses the remote server.

## Status

Experimental with low-traffic production deployment. Breaking changes are acceptable.

## Stack

- **Backend**: Hono, oRPC (type-safe RPC with OpenAPI)
- **Database**: SQLite via D1, Drizzle ORM
- **Storage**: Cloudflare R2
- **AI Providers**: Runware (queue-based async with webhooks)
- **Infra**: Alchemy (TypeScript IaC for Cloudflare), Durable Objects
- **Tooling**: Turborepo, Bun, Oxlint, Oxfmt

## Env Types

The global `Env` interface is declared manually in `packages/env/src/env.d.ts`. **Do not** use Alchemy's inferred `typeof server.Env` — its `Bound<T>` conditional type chain triggers TS2589 (excessively deep type instantiation). When adding a binding in `packages/infra/alchemy.run.ts`, add the corresponding property to `env.d.ts` using the Cloudflare runtime type (`D1Database`, `R2Bucket`, `DurableObjectNamespace`, etc).

## Context

`Context` from `apps/server/src/context.ts` is the standard context passed to internal functions. Contains `env: Env` and `headers: Headers`. Functions that need bindings accept `(ctx: Context, args)` — not individual bindings.

## API

- **REST** (`/api/*`) — OpenAPI spec at `/api/.well-known/openapi.json`
- **RPC** (`/rpc/*`) — oRPC endpoints
- **Webhooks** (`/webhooks/runware`) — provider callbacks
- **Auth**: Mutations require `x-api-key` header. Queries are public.

## Database

Schema in `packages/db/src/schema/`. Migrations in `packages/db/src/migrations/`.

- Run `bun run db:generate` after schema changes
- Migrations applied automatically by Alchemy on deploy

## Infrastructure

Alchemy (`packages/infra/alchemy.run.ts`) defines all Cloudflare resources:

- D1Database, R2Bucket, Worker, DurableObjectNamespace, Ai, Images
- State stored remotely (survives local deletion)
- URLs derived from stage name
