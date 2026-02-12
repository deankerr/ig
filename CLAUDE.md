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
- Webhooks require a public URL, so local development uses the remote server.
- LSP diagnostics are often stale in this project - `bun run check` is the source of truth.

## Features

- Organise code into directories by "feature", "service", etc.
- The exact shape is not strict and may shift over time.
- In React, this should look like `components/` sub-directories.
  - Do not place feature-level code in a 'route' file - this should be for "page" level concerns, and/or glueing major feature components together.

## In-Code Documentation

Use a structured logging approach with console.log when events/actions/mutations occur, in both the server and web app. This helps us to quickly identify and resolve most issues quickly.

- Use this format `console.log([module:function] optional message, { data })`.
- Avoid logging queries which trigger often.
- The browser devtools neatly collapses large data items - favour full object logging there.
- Do not log during render in React, and be mindful of not spamming the buffer as a result of user actions like typing in an input.
- The ability or ease of logging events to the console should never be a consideration when designing the flow of business logic.

Comments are also valuable for navigating the code base, especially when reviewing changes.

- Write a short comment at the start of each "paragraph" of code in a multi-step function.
- Full JSDoc annotations for our main function paths are not necessary, as we are changing them often - keep it light.
- Use `TODO` comments to clearly mark areas where functionality has been stubbed out, or is planned to be implemented in the near future.
  - NOT for "nice to haves" or features that have not been planned or discussed.

NOTE: Modules in our codebase that originated externally or are auto-generated are excluded from these requirements.

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
