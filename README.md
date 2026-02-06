# ig

A microservice for generative AI inference, artifact storage, and retrieval. The shared backend for AI-powered apps.

## What It Does

- **Inference orchestration** via fal.ai and Runware - text-to-image, image-to-image, image-to-video, vision models
- **Artifact storage** - outputs in R2, inputs and metadata in D1
- **Full provenance** - every artifact retains input parameters, model, timing, metrics
- **Flexible tagging** - consumers define their own organization schemes
- **Unified API** - same interface regardless of provider or modality

See [VISION.md](VISION.md) for design philosophy and scope boundaries.

## Quick Start

```bash
bun install
bun run dev        # Start full stack via Alchemy
```

- Web UI: http://localhost:3221
- API: http://localhost:3220

## Commands

```bash
bun run dev           # Start full stack (server + web via Alchemy)
bun run dev:web       # Start only web frontend
bun run dev:server    # Start only API server
bun run check         # check-types + lint + format (with auto-fix)
bun run clean         # Remove node_modules, build artifacts, caches
bun run db:generate   # Generate Drizzle migrations
bun run deploy        # Deploy to Cloudflare via Alchemy
```

## API

Submit a generation request, get an artifact back. The service handles async complexity via provider webhooks.

Two API styles available:

- **REST API** (`/api/*`) - OpenAPI spec at `/api/.well-known/openapi.json`
- **RPC** (`/rpc/*`) - oRPC endpoints, used by the web UI

```bash
# Create a generation
curl -X POST $SERVER_URL/api/generations/create \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{"provider":"fal","model":"fal-ai/flux/schnell","input":{"prompt":"a cat"}}'

# Get generation status
curl -X POST $SERVER_URL/api/generations/get \
  -H "Content-Type: application/json" \
  -d '{"id":"<generation-id>"}'

# Get output file (any extension works, for embedding in IRC clients, etc.)
curl "$SERVER_URL/generations/{id}/file.png"
```

**Auth**: Mutations require `x-api-key` header. Queries are public.

## Stack

- **Runtime**: Cloudflare Workers + D1 + R2
- **API**: Hono + oRPC (type-safe RPC with OpenAPI)
- **Database**: Drizzle ORM with SQLite
- **AI Providers**: fal.ai, Runware (queue-based async with webhooks)
- **Frontend**: React 19 + TanStack Router/Query + Tailwind 4 + shadcn/ui
- **Infra**: Alchemy (TypeScript IaC for Cloudflare)
- **Tooling**: Turborepo, Bun, Oxlint, Oxfmt

## Project Structure

```
apps/
  server/     Hono API on Cloudflare Workers
  web/        Admin console UI (React + TanStack Router)
packages/
  config/     Shared tsconfig
  db/         Drizzle schema and migrations
  env/        Environment validation and Cloudflare binding types
  infra/      Alchemy infrastructure-as-code
```
