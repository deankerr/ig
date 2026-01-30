# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Always read @VISION.md for a high level understanding of our project.

- `apps/server/` core backend service
- `apps/web/` ig-console: developer focused admin UI for generation management and observability

## Workflow

- Run `bun check` to type check, lint and format your work.
- Do not deploy to the remote dev environment unless specifically asked to.

## Status

- This project is experimental with a low-traffic production deployment. Breaking changes are acceptable - don't hesitate to make them.
- Webhooks require a public URL, so local development uses the remote server.

## Working Guidelines

**Stop after 3 failed attempts on critical operations.** For operations like schema migrations, deployments, or anything requiring interactive input - if you've tried 3 times without success, stop and report the issue to me. Don't keep retrying with variations. Explain what's blocking you so I can intervene.

**Verify external API schemas before implementing.** Before writing code that integrates with external APIs, make a test request to verify the actual response structure. Never rely on memory or earlier research - APIs change and memories are unreliable.

**Alert immediately on deployment errors.** When you encounter deployment errors (5xx) that you cannot diagnose, immediately alert me rather than guessing at fixes. You do not have reliable access to Cloudflare Worker logs - ask me to check the dashboard.

**Don't debug silently.** When debugging hits a wall - especially with infrastructure or logs you can't access - report the blocker immediately. Don't silently iterate through approaches.

## Commands

```bash
bun run dev           # Start full stack (server:3000, web:3001) via Alchemy
bun run dev:web       # Start only web frontend
bun run dev:server    # Start only API server
bun run check         # check-types + lint + format (oxlint --fix && oxfmt --write)
bun run check-types   # TypeScript type checking across all packages
bun run db:generate   # Generate Drizzle migrations (applied by Alchemy on deploy)
bun run deploy        # Deploy to Cloudflare via Alchemy
```

## Architecture

Turborepo monorepo with Bun. Two apps, four packages:

```
apps/web/              → React 19 + TanStack Router + Vite (port 3001)
apps/server/           → Hono + oRPC on Cloudflare Workers (port 3000)
packages/api/          → oRPC procedures and routers (business logic)
packages/db/           → Drizzle ORM schema (SQLite/D1)
packages/env/          → Type-safe env validation and Cloudflare binding types
packages/infra/        → Alchemy infrastructure-as-code (see notes/alchemy.md)
packages/provider-fal/ → fal.ai integration (submit + webhook)
packages/provider-runware/ → Runware integration (submit + webhook)
```

## Key Patterns

**API Layer** (`packages/api/src/index.ts`):

- oRPC procedures with `publicProcedure` and `apiKeyProcedure`
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
- Run `bun run db:generate` to generate migrations from schema changes. No other Drizzle commands are needed.
- Migrations are applied automatically by Alchemy during `bun run deploy`

**Infrastructure** (`packages/infra/alchemy.run.ts`):

Alchemy is TypeScript-native infrastructure-as-code. See `notes/alchemy.md` for detailed documentation.

Key points:

- Resources defined as async functions (D1Database, R2Bucket, Worker, Vite)
- State stored remotely in CloudflareStateStore (survives local file deletion)
- URLs derived from stage name - no per-environment .env files needed
- `bun run deploy` deploys all resources to Cloudflare

Alchemy makes creating and destroying any kind of Cloudflare resource as simple as writing a few lines of code. Use them!

## API Reference

- **REST API** (`/api/*`) - OpenAPI-compatible, GET `/api/.well-known/openapi.json` for spec
- **RPC** (`/rpc/*`) - oRPC endpoints, used by the web UI
- **Authentication**: Mutations require `x-api-key` header. Queries are public.

Routers: `packages/api/src/routers/` (generations, models, presets)

## Stack

- **Frontend**: React 19, TanStack Router/Query, Tailwind 4, shadcn/ui, next-themes
- **Backend**: Hono, oRPC (type-safe RPC with OpenAPI)
- **Database**: SQLite via D1, Drizzle ORM
- **Storage**: Cloudflare R2
- **AI Providers**: fal.ai, Runware (queue-based async with webhooks)
- **Infra**: Alchemy (TypeScript IaC for Cloudflare)
- **Tooling**: Turborepo, Oxlint, Oxfmt, Lefthook (pre-commit hooks)

## Providers

We support multiple inference providers. Each has its own package under `packages/provider-*`.

### fal.ai

fal.ai offers 500+ AI endpoints across modalities (image, video, audio, vision).

**Request structure:**

```
generations.create({ provider: "fal", model, input })
        ↓
submitToFal({ endpoint: model, input, webhookUrl })
        ↓
fal.queue.submit(endpoint, { input, webhookUrl })
```

- `model` field IS the fal endpoint path (e.g., `fal-ai/flux/schnell`)
- `input` passes through to fal unchanged
- Uses official `@fal-ai/client` SDK
- Returns `requestId` for tracking

**Resources:**

- Model catalog: https://fal.ai/models
- Queue API docs: https://docs.fal.ai/model-apis/model-endpoints/queue
- Webhooks: https://docs.fal.ai/model-apis/model-endpoints/webhooks
- OpenAPI schemas: `https://fal.ai/api/openapi/queue/openapi.json?endpoint_id={endpoint}`

### Runware

Runware provides fast image generation with Civitai model support.

**Request structure:**

```
generations.create({ provider: "runware", model, input })
        ↓
submitToRunware({ input: { ...input, model, taskUUID, webhookURL } })
        ↓
POST https://api.runware.ai/v1
  [{ taskType: "authentication", apiKey }, input]
```

- `model` is an AIR identifier (e.g., `civitai:108@1`) - injected into input
- `taskUUID` is our generation ID - doubles as request ID
- `webhookURL` included in the task payload
- Payload is array: `[authTask, inferenceTask]`

**Automatic defaults applied:**

```typescript
input.taskType ??= "imageInference"
input.positivePrompt ??= input.prompt  // fal compatibility
input.includeCost ??= true
input.width ??= 1024
input.height ??= 1024
```

**Resources:**

- API docs: https://runware.ai/docs
- Image inference: https://runware.ai/docs/en/image-inference/api-reference
