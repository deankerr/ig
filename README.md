# ig

Generative AI inference, artifact storage, and retrieval — the shared backend for my AI-powered apps.

ig is infrastructure, not an end-user product. It handles the boilerplate of working with generative AI so the apps that consume it don't have to: submit a request, get an artifact back. The service manages the async complexity, stores everything, and exposes one API regardless of which model or modality is in play. Consumers are whatever I'm building that needs to generate content — web apps, Discord bots, CLI tools.

## What it does

- **Inference orchestration** — submit a generation request and ig dispatches it to [Runware](https://runware.ai), tracks it to completion, and stores the result. Async by default; a `sync:true` mode blocks on the result for fast models. (`apps/server/src/inference/`)
- **Artifact storage** — outputs land in R2, inputs and metadata in D1. Every artifact keeps the input parameters, model, seed, timing, and cost that produced it, so provenance is never lost. (`packages/db/src/schema/`)
- **Tags as request context** — `tags` attached to a generation propagate onto its artifacts, carrying source-system IDs, routing info, user-visible labels, or short-lived consumer state. They're the searchable projection of why an artifact exists. The `ig:slug` tag also serves as a custom URL path for an artifact file. (`apps/server/src/services/tags.ts`)
- **Lifecycle events** — domain events (`artifact.created`, etc.) publish to a Cloudflare Queue with their request tags attached, so consumers can react without polling. (`apps/server/src/inference/events.ts`)
- **Admin console** — a web UI for browsing generations and artifacts, inspecting metadata, and submitting requests. (`apps/web/`)
- **Unified API** — the same REST + RPC surface regardless of model or modality, documented via OpenAPI.

The guiding bias: **artifacts are the point.** The inference job is transient plumbing; what matters is the library of generated content that accumulates over time. R2 is cheap, so ig stores everything — inputs, outputs, errors, metrics — and asks questions later.

## Architecture

Turborepo monorepo. Three Cloudflare Workers apps and four shared packages.

| Workspace          | Role                                                                                                       |
| ------------------ | ---------------------------------------------------------------------------------------------------------- |
| `apps/server`      | Hono + oRPC API on Cloudflare Workers — inference orchestration, artifact storage, REST + RPC endpoints    |
| `apps/web`         | React 19 admin console (Vite + TanStack + shadcn/ui) — browse artifacts, inspect metadata, submit requests |
| `apps/discord-bot` | Discord bot consumer — `/imagine`, driven off the generation event queue                                   |
| `packages/db`      | Drizzle ORM schema (SQLite / D1) — generations, artifacts, tags                                            |
| `packages/env`     | Cloudflare binding and env type helpers                                                                    |
| `packages/infra`   | Alchemy infrastructure-as-code — defines all Cloudflare resources                                          |
| `packages/config`  | Shared tsconfig / tooling base                                                                             |

### Request lifecycle

1. **Submit** — `generations.create` validates input against a per-provider profile and dispatches to Runware.
2. **Track** — a Durable Object holds the request's state as the source of truth for the duration of its lifecycle, progressively projecting into D1 as the generation advances.
3. **Persist** — finished artifacts are written to R2; their metadata, tags, and provenance land in D1.
4. **Notify** — lifecycle events publish to the shared `generation-events` queue for async consumers.

All oRPC endpoints are POST and require an `x-api-key` header. Artifact _files_ can be served publicly by id or slug (`/a/{slug}`, `/artifacts/{id}/file`) without exposing tag metadata. Scalar API docs are at `/api`, the OpenAPI spec at `/api/spec.json`.

### Stack

TypeScript throughout. Hono + oRPC for the API, Drizzle ORM over D1, React 19 + TanStack + shadcn/ui for the console, Zod for validation at boundaries, Remeda for data transforms. Everything runs on Cloudflare — Workers, D1, R2, Queues, Durable Objects — provisioned as code with [Alchemy](https://alchemy.run). Tooling is bun + Turborepo with the [OXC](https://oxc.rs) toolchain (oxlint + oxfmt).

## Development

Requires [bun](https://bun.sh).

```bash
bun install

bun run dev:web   # web admin console
bun run check     # type check + lint + format (oxlint + oxfmt)
bun run deploy    # deploy to Cloudflare via Alchemy
```

## Status

Experimental, with a low-traffic production deployment on Cloudflare (`*.ig.orb.town`, behind a blanket Access policy). It runs and is consumed by my other projects, but breaking changes are acceptable and there are no tests yet. MIT licensed.
