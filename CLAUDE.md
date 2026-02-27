# CLAUDE.md

Always read @VISION.md for a high level understanding of the project.

## Status

Experimental with low-traffic production deployment. Breaking changes are acceptable.

### Focus Stories

Image-To-Image Workflow:

- IRC chatbot users want to edit images from external URLs
- auto aspect ratio sizing is always used, there is currently no method to use a set size
- Any url they supply in the prompt is passed to referenceImages
- we need to be able to specify the size of the output that will match an input image (i.e. the first one)
- pixel values need to be converted to value runware width/height values (divisible by 64)
- clients should not be expected to manage this themselves
- the CF Images binding can be used to determine if a file is an image, and its width/height

File Storage:

- It would be good to accept arbitrary file uploads, as well as "fetch URL content to artifact"
- These could just be artifacts, but without an associated 'generation'

Notes:

- This does not involve Runware's Image Upload feature; it's currently rare that the same image is being used more than once.
- Helpers/workflows around calculating/transforming sizes should be kept decoupled from any specific process.

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
bun run check         # check-types + fix + format
bun run deploy        # Deploy to Cloudflare via Alchemy
```

## Features

- Organise code into directories by "feature", "service", etc.
- The exact shape is not strict and may shift over time.
- In React, this should look like `components/` sub-directories.
  - Do not place feature-level code in a 'route' file - this should be for "page" level concerns, and/or glueing major feature components together.

## Env Types

The global `Env` interface is declared manually in `packages/env/src/env.d.ts`. **Do not** use Alchemy's inferred `typeof server.Env` — its `Bound<T>` conditional type chain triggers TS2589 (excessively deep type instantiation). When adding a binding in `packages/infra/alchemy.run.ts`, add the corresponding property to `env.d.ts` using the Cloudflare runtime type (`D1Database`, `R2Bucket`, `DurableObjectNamespace`, etc).

## API

- **REST** (`/api/*`) — Scalar docs at `/api`, OpenAPI spec at `/api/spec.json`
- **RPC** (`/rpc/*`) — oRPC endpoints (used by the web app via RPCLink)
- **Webhooks** (`/webhooks/runware`) — provider callbacks
- **Auth**: All endpoints require `x-api-key` header.

```bash
source .env; curl -s -X POST "${DEV_SERVER_URL}/api/generations/create" \
  -H "Content-Type: application/json" -H "x-api-key: ${API_KEY}" \
  -d '{"model":"civitai:4384@128713","positivePrompt":"a cat","sync":true}'
```

### Artifact Slug URLs

Artifacts can have human-readable URLs via the tag system. A slug is stored as a tag with key `ig:slug` in the `tags` junction table — not as a column on `artifacts`.

**Format:** `{uuid-prefix}-{slugified-text}` where the prefix is the first 12 hex chars of the artifact's UUIDv7 ID (~1ms timestamp resolution, prevents collisions).

**Routes:**

- `GET /a/{slug}[.ext]` — resolves slug → artifact via tag lookup → serves R2 file
- `GET /artifacts/{id}/file` — direct access by artifact ID (no tag lookup)

**Flow:** Consumer passes `tags: { "ig:slug": "my description" }` when creating a generation. The server normalizes it to `{uuid-prefix}-my-description` via `normalizeTagValues()` in `routers/utils.ts`, then persists it with `upsertTags()`.

**Key files:** `apps/server/src/routes/file.ts` (routing), `apps/server/src/routers/utils.ts` (slug normalization + tag persistence).

## Infrastructure

Alchemy (`packages/infra/alchemy.run.ts`) defines all Cloudflare resources.

## Models

These models are fast and cost practically nothing. Use them when testing inference functionality.

- `runware:400@1` FLUX.2 dev
- `rundiffusion:120964@131579` RunDiffusionXL (SDXL)
- `civitai:4384@128713` DreamShaper (SD1.5)

## Remeda

Use Remeda to write clean, functional code. `import * as R from 'remeda'`

## Reference

See @notes for Runware API schemas/docs
