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

## Environment Variables

Create `packages/infra/.env` before deploying:

```bash
# Alchemy configuration
ALCHEMY_PASSWORD=<generate with: openssl rand -base64 32>
ALCHEMY_STATE_TOKEN=<generate with: openssl rand -base64 32>

# Dev deployment (workers.dev subdomain)
CF_WORKERS_SUBDOMAIN=<your-cloudflare-workers-subdomain>  # e.g., "my-account"

# Prod deployment (custom domains)
PROD_SERVER_DOMAIN=api.yourdomain.com
PROD_WEB_DOMAIN=app.yourdomain.com

# Secrets (passed to workers via Alchemy bindings)
FAL_KEY=<your fal.ai API key>
API_KEY=<generate with: openssl rand -base64 32>
```

Alchemy controls what each worker receives via bindings - no separate `.env` files needed per app.

## API

Submit a generation request, get an artifact back. The service handles async complexity via fal.ai webhooks.

Two API styles available:

- **REST API** (`/api/*`) - OpenAPI-compatible, recommended for external use
- **RPC** (`/rpc/*`) - oRPC endpoints, used by the web UI

```bash
# Create a generation
curl -X POST $SERVER_URL/api/generations/create \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{"endpoint":"fal-ai/flux/schnell","input":{"prompt":"a cat"}}'

# Get generation status
curl -X POST $SERVER_URL/api/generations/get \
  -H "Content-Type: application/json" \
  -d '{"id":"<generation-id>"}'

# Get output file (any extension works, for embedding in IRC clients, etc.)
curl "$SERVER_URL/generations/{id}/file.png"
```

**Endpoints** (all POST with JSON body):

- `/api/generations/create` - Submit to fal.ai queue (API key required)
- `/api/generations/list` - Paginated list with filters
- `/api/generations/get` - Get single generation by ID
- `/api/generations/update` - Modify tags (API key required)
- `/api/generations/delete` - Delete from D1 and R2 (API key required)
- `/api/generations/regenerate` - Clone with same input (API key required)
- `GET /generations/:id/file*` - Serve output file (any extension accepted)

## Commands

```bash
bun run dev           # Start full stack (server:3000, web:3001)
bun run check         # check-types + lint + format
bun run check-types   # TypeScript type checking
bun run db:generate   # Generate Drizzle migrations
bun run deploy        # Deploy to Cloudflare
```

## Stack

- **Runtime**: Cloudflare Workers + D1 + R2
- **API**: Hono + oRPC (type-safe RPC with OpenAPI)
- **Database**: Drizzle ORM with SQLite
- **AI Provider**: fal.ai (queue-based async with webhooks)
- **Frontend**: React 19 + TanStack Router + Vite
- **Infra**: Alchemy (TypeScript IaC) - see [notes/alchemy.md](notes/alchemy.md)

## Project Structure

```
apps/
  server/     → Hono API on Cloudflare Workers
  web/        → Admin console UI (React + TanStack Router)
packages/
  api/        → oRPC procedures and business logic
  db/         → Drizzle schema and migrations
  env/        → Environment validation and Cloudflare binding types
  infra/      → Alchemy infrastructure-as-code
```
