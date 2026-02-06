# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

Always read @VISION.md for a high level understanding of our project.

## Structure

```
apps/server/     # Hono + oRPC on Cloudflare Workers (port 3220)
apps/web/        # React 19 + TanStack Router + Vite (port 3221)
packages/db/     # Drizzle ORM schema (SQLite/D1)
packages/env/    # Cloudflare binding types
packages/infra/  # Alchemy infrastructure-as-code
```

See `apps/server/CLAUDE.md` for server-specific patterns (Result type, error handling).

## Commands

```bash
bun run dev           # Start full stack via Alchemy
bun run dev:web       # Start only web frontend
bun run dev:server    # Start only API server
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

- **Frontend**: React 19, TanStack Router/Query, Tailwind 4, shadcn/ui
- **Backend**: Hono, oRPC (type-safe RPC with OpenAPI)
- **Database**: SQLite via D1, Drizzle ORM
- **Storage**: Cloudflare R2
- **AI Providers**: fal.ai, Runware (queue-based async with webhooks)
- **Infra**: Alchemy (TypeScript IaC for Cloudflare)
- **Tooling**: Turborepo, Bun, Oxlint, Oxfmt

## API

- **REST** (`/api/*`) - OpenAPI spec at `/api/.well-known/openapi.json`
- **RPC** (`/rpc/*`) - oRPC endpoints, used by web UI
- **Webhooks** (`/webhooks/fal`, `/webhooks/runware`) - provider callbacks
- **Auth**: Mutations require `x-api-key` header. Queries are public.

## Providers

Providers live in `apps/server/src/providers/`. Each has:

- `create.ts` - Submit generation to provider
- `webhook.ts` - Handle provider callback
- `resolve.ts` - Parse webhook payload into `ProviderResult`

### fal.ai

```
generations.create({ provider: "fal", model, input })
  -> fal.queue.submit(model, { input, webhookUrl })
  -> webhook receives result
  -> resolve verifies signature, fetches URLs
```

- `model` is the fal endpoint path (e.g., `fal-ai/flux/schnell`)
- `input` passes through unchanged
- Signature verification via Ed25519

### Runware

```
generations.create({ provider: "runware", model, input })
  -> POST https://api.runware.ai/v1 [authTask, inferenceTask]
  -> webhook receives result
  -> resolve validates with Zod, decodes base64/URLs
```

- `model` is an AIR identifier (e.g., `civitai:108@1`)
- `taskUUID` is our generation ID
- No signature verification (relies on URL secrecy)

**Automatic defaults:**

```typescript
input.taskType ??= "imageInference"
input.positivePrompt ??= input.prompt
input.width ??= 1024
input.height ??= 1024
```

## Database

Schema in `packages/db/src/schema/`. Migrations in `packages/db/src/migrations/`.

- Run `bun run db:generate` after schema changes
- Migrations applied automatically by Alchemy on deploy

## Infrastructure

Alchemy (`packages/infra/alchemy.run.ts`) defines all Cloudflare resources:

- D1Database, R2Bucket, Worker, Vite
- State stored remotely (survives local deletion)
- URLs derived from stage name
