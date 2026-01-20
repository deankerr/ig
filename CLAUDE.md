# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Always read @VISION.md for a high level understanding of our project.

- `apps/server/` is the main backend service.
- `apps/web/` will become our admin console UI, which should be purely developer focused, utilising the server's APIs for artifact/job obervability and management, and can also have a basic generation playground.

## Status

- This project is the early, experimental stage. There is no production deployment. No data or outputs need to be preserved.
- Now is the time to make breaking changes - not after we've deployed to production. Never consider backwards compatibility.
- There is a live development deployment which should be use for any demonstrations, as we can't receive webhooks locally.

## Development Environment

**We use the remote Cloudflare deployment as our primary dev environment**, not local Miniflare. This is because:

- Webhooks require a publicly accessible URL (fal.ai needs to call us back)
- The local web app is configured to point at the remote server during local development
- Local Miniflare is available but rarely used

**Finding deployed URLs:**

```bash
# Quick way - read from env files
grep VITE_SERVER_URL apps/web/.env | cut -d= -f2

# Or query Alchemy deployment state
cd packages/infra && bun alchemy run | grep -E "Web|Server"
```

**To interact with the deployed server directly:**

```bash
# Get current server URL
SERVER_URL=$(grep VITE_SERVER_URL apps/web/.env | cut -d= -f2)

# Example API calls
curl $SERVER_URL/
curl -X POST $SERVER_URL/api/healthCheck
```

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
