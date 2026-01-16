# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Always read @VISION.md for a high level understanding of our project.

- `apps/server/` is currently our main focus, along with its supporting packages.
- `apps/web/` will become our admin console UI.

## Commands

```bash
bun run dev           # Start full stack (server:3000, web:3001) via Alchemy
bun run dev:web       # Start only web frontend
bun run dev:server    # Start only API server
bun run build         # Build all packages
bun run check         # Lint + format (oxlint --fix && oxfmt --write)
bun run check-types   # TypeScript type checking across all packages
bun run db:push       # Push Drizzle schema to database
bun run db:generate   # Generate Drizzle migrations
bun run deploy        # Deploy to Cloudflare via Alchemy
```

## Architecture

Turborepo monorepo with Bun. Two apps, five packages:

```
apps/web/       → React 19 + TanStack Router + Vite (port 3001)
apps/server/    → Hono + oRPC on Cloudflare Workers (port 3000)
packages/api/   → oRPC procedures and routers (business logic)
packages/auth/  → Better-Auth config with Drizzle adapter
packages/db/    → Drizzle ORM schema (SQLite/Turso)
packages/env/   → t3-oss/env validation (separate web.ts and server.ts)
packages/infra/ → Alchemy infrastructure-as-code
```

## Key Patterns

**API Layer** (`packages/api/src/index.ts`):

- oRPC procedures with `publicProcedure` and `protectedProcedure`
- Context created from Hono context in `packages/api/src/context.ts`
- Router assembled in `packages/api/src/routers/index.ts`

**Frontend Routing** (`apps/web/src/routes/`):

- TanStack Router file-based routing (auto-generates `routeTree.gen.ts`)
- Protected routes use `beforeLoad` to check session and redirect
- Root route (`__root.tsx`) provides orpc client and queryClient context

**Data Fetching** (`apps/web/src/utils/orpc.ts`):

- oRPC client with React Query integration
- Credentials included in requests, errors surfaced via Sonner toasts

**Authentication**:

- Server: `packages/auth/src/index.ts` (Better-Auth with email/password)
- Client: `apps/web/src/lib/auth-client.ts` (createAuthClient)

**Database** (`packages/db/src/schema/`):

- Drizzle with SQLite core types
- Migrations in `packages/db/src/migrations/`

**Infrastructure** (`packages/infra/alchemy.run.ts`):
Alchemy is TypeScript-native infrastructure-as-code. Resources are async functions that run in any JS environment - no DSL, no YAML, no separate state backend.

```typescript
const app = await alchemy("ig");
const db = await D1Database("database", { migrationsDir: "..." });
const server = await Worker("server", { bindings: { DB: db, ... } });
await app.finalize();  // cleans up orphaned resources
```

Key concepts:

- `alchemy.env.VAR` for regular env vars, `alchemy.secret.env.VAR` for secrets
- Resources are memoized - same call returns same resource
- `app.finalize()` handles deletion of resources no longer in code
- State stored locally in `.alchemy/` (can be git-ignored or committed)
- `bun run dev` in infra starts local Miniflare with D1 + Workers

## Stack

- **Frontend**: React 19, TanStack Router/Query/Form, Tailwind 4, shadcn/ui, next-themes
- **Backend**: Hono, oRPC (type-safe RPC with OpenAPI)
- **Database**: SQLite via Turso/LibSQL, Drizzle ORM
- **Auth**: Better-Auth with Drizzle adapter
- **AI**: Google Generative AI SDK, Vercel AI SDK (streaming)
- **Infra**: Alchemy (TypeScript IaC for Cloudflare D1, Workers, Vite)
- **Tooling**: Turborepo, Oxlint, Oxfmt, Lefthook (pre-commit hooks)
