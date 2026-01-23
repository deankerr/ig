# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Always read @VISION.md for a high level understanding of our project.

- `apps/server/` is the main backend service.
- `apps/web/` ig-console
  - Developer focused admin UI for generation/artifact management and observability
  - Simple but flexible

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
packages/auth/  → Better-Auth config (not currently used, placeholder for future)
packages/db/    → Drizzle ORM schema (SQLite/D1)
packages/env/   → Type-safe env validation and Cloudflare binding types
packages/infra/ → Alchemy infrastructure-as-code (see notes/alchemy.md)
```

## Key Patterns

**API Layer** (`packages/api/src/index.ts`):

- oRPC procedures with `publicProcedure` and `protectedProcedure`
- Context created from Hono context in `packages/api/src/context.ts`
- Router assembled in `packages/api/src/routers/index.ts`

**Frontend Routing** (`apps/web/src/routes/`):

- TanStack Router file-based routing (auto-generates `routeTree.gen.ts`)
- Root route (`__root.tsx`) provides orpc client and queryClient context

**Data Fetching** (`apps/web/src/utils/orpc.ts`):

- oRPC client with React Query integration
- Errors surfaced via Sonner toasts

**Database** (`packages/db/src/schema/`):

- Drizzle with SQLite core types
- Migrations in `packages/db/src/migrations/`

**Infrastructure** (`packages/infra/alchemy.run.ts`):

Alchemy is TypeScript-native infrastructure-as-code. See `notes/alchemy.md` for detailed documentation.

Key points:

- Resources defined as async functions (D1Database, R2Bucket, Worker, Vite)
- State stored remotely in CloudflareStateStore (survives local file deletion)
- URLs derived from stage name - no per-environment .env files needed
- `bun run deploy` deploys all resources to Cloudflare

## API Reference

The server exposes two API styles:

- **REST API** (`/api/*`) - OpenAPI-compatible, recommended for scripts and external clients
- **RPC** (`/rpc/*`) - oRPC endpoints, used by the web UI

**Authentication:** Mutations require `x-api-key` header (value from `API_KEY` env var). Queries are public.

### Generations (`/api/generations/*` or `/rpc/generations/*`)

| Procedure    | Auth    | Description                                                  |
| ------------ | ------- | ------------------------------------------------------------ |
| `create`     | API key | Submit generation to fal.ai queue                            |
| `list`       | Public  | Paginated list with filters (status, endpoint, tags, cursor) |
| `get`        | Public  | Get single generation by ID                                  |
| `updateTags` | API key | Add/remove tags on a generation                              |
| `delete`     | API key | Delete generation from D1 and R2                             |
| `regenerate` | API key | Clone a generation with same input                           |
| `listTags`   | Public  | Get all unique tags                                          |

**Create input:**

```typescript
{ endpoint: string, input: Record<string, unknown>, tags?: string[] }
```

**List input:**

```typescript
{ status?: "pending" | "ready" | "failed", endpoint?: string, tags?: string[], limit?: number, cursor?: string }
```

### Direct HTTP Endpoints

| Route                    | Method | Description                                                                  |
| ------------------------ | ------ | ---------------------------------------------------------------------------- |
| `/`                      | GET    | Health check, returns "OK"                                                   |
| `/generations/:id/file*` | GET    | Serve generation output file. Any extension accepted (e.g., `.png`, `.jpg`). |
| `/webhooks/fal`          | POST   | fal.ai webhook receiver (Ed25519 signature verified)                         |

### Image Transforms

The `/generations/:id/file*` endpoint supports on-the-fly image transformation via query params. Uses Cloudflare Images binding.

| Param | Description                                         |
| ----- | --------------------------------------------------- |
| `w`   | Max width in pixels                                 |
| `h`   | Max height in pixels                                |
| `f`   | Output format: `png`, `jpeg`, `gif`, `webp`, `avif` |
| `q`   | Quality 1-100                                       |

**Format negotiation:** If `f=avif` but client doesn't support it (checked via `Accept` header), falls back to webp, then original format.

**Supported input formats:** `image/png`, `image/jpeg`, `image/gif`, `image/webp`

**Non-images:** Videos/audio served as-is (no transform attempted).

### Example Usage

```bash
# Create a generation (requires API key)
curl -X POST $SERVER_URL/api/generations/create \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{"endpoint":"fal-ai/flux/schnell","input":{"prompt":"a cat"}}'

# Get generation status (REST API uses POST with JSON body)
curl -X POST $SERVER_URL/api/generations/get \
  -H "Content-Type: application/json" \
  -d '{"id":"<generation-id>"}'

# Get file with extension (for embedding in IRC, etc.)
curl "$SERVER_URL/generations/{id}/file.png"

# Get resized thumbnail
curl "$SERVER_URL/generations/{id}/file.png?w=200"

# Get webp version
curl -H "Accept: image/webp,*/*" "$SERVER_URL/generations/{id}/file.png?f=webp"

# Combined: resize + format + quality
curl -H "Accept: image/webp,*/*" "$SERVER_URL/generations/{id}/file.png?w=400&f=webp&q=80"
```

## Stack

- **Frontend**: React 19, TanStack Router/Query/Form, Tailwind 4, shadcn/ui, next-themes
- **Backend**: Hono, oRPC (type-safe RPC with OpenAPI)
- **Database**: SQLite via D1, Drizzle ORM
- **Storage**: Cloudflare R2
- **AI Provider**: fal.ai (queue-based async with webhooks)
- **Infra**: Alchemy (TypeScript IaC for Cloudflare)
- **Tooling**: Turborepo, Oxlint, Oxfmt, Lefthook (pre-commit hooks)
