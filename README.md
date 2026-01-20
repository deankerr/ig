# ig

A microservice for generative AI inference, artifact storage, and retrieval. The shared backend for AI-powered apps.

## What It Does

- **Inference orchestration** via fal.ai - text-to-image, image-to-image, image-to-video, vision models
- **Artifact storage** - outputs in R2, inputs and metadata in D1
- **Full provenance** - every artifact retains input parameters, endpoint, timing, metrics
- **Flexible tagging** - consumers define their own organization schemes
- **Unified API** - same interface regardless of endpoint or modality

See [VISION.md](VISION.md) for design philosophy and scope boundaries.

## Quick Start

```bash
bun install
bun run dev        # Start full stack via Alchemy
```

- Web UI: http://localhost:3001
- API: http://localhost:3000

## API

Submit a generation request, get an artifact back. The service handles async complexity via fal.ai webhooks.

```bash
# Create a generation
curl -X POST $SERVER_URL/rpc/generations/create \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{"endpoint":"fal-ai/flux/schnell","input":{"prompt":"a cat"}}'

# List generations
curl "$SERVER_URL/rpc/generations/list?status=ready"

# Get output file (extension required for embedding in IRC clients, etc.)
curl "$SERVER_URL/generations/{id}/file.png"
```

**Endpoints:**
- `POST /rpc/generations/create` - Submit to fal.ai queue (API key required)
- `GET /rpc/generations/list` - Paginated list with filters
- `GET /rpc/generations/get` - Get single generation
- `POST /rpc/generations/updateTags` - Modify tags (API key required)
- `POST /rpc/generations/delete` - Delete from D1 and R2 (API key required)
- `POST /rpc/generations/regenerate` - Clone with same input (API key required)
- `GET /generations/:id/file.:ext` - Serve output file

## Commands

```bash
bun run dev           # Start full stack (server:3000, web:3001)
bun run build         # Build all packages
bun run check         # Lint + format (oxlint + oxfmt)
bun run check-types   # TypeScript type checking
bun run db:push       # Push Drizzle schema to D1
bun run deploy        # Deploy to Cloudflare
```

## Stack

- **Runtime**: Cloudflare Workers + D1 + R2
- **API**: Hono + oRPC (type-safe RPC with OpenAPI)
- **Database**: Drizzle ORM with SQLite
- **AI Provider**: fal.ai (queue-based async with webhooks)
- **Frontend**: React 19 + TanStack Router + Vite
- **Infra**: Alchemy (TypeScript IaC)

## Project Structure

```
apps/
  server/     → Hono API on Cloudflare Workers
  web/        → Admin console UI (React + TanStack Router)
packages/
  api/        → oRPC procedures and business logic
  auth/       → Better-Auth configuration
  db/         → Drizzle schema and migrations
  env/        → Environment validation (t3-oss/env)
  infra/      → Alchemy infrastructure-as-code
```
