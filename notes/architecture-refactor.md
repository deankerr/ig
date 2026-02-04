# Architecture Refactor Plan

Simplify the codebase by collapsing packages into where they're actually used.

## Current State

```
apps/
  server/              # Hono app, services, context
  web/                 # React app, imports @ig/api for client types

packages/
  api/                 # oRPC routers (re-exports types for web)
  db/                  # Drizzle schema
  env/                 # Env types (Alchemy/T3 integration)
  provider-fal/        # fal create + webhook
  provider-runware/    # Runware create + webhook
```

**Problems:**

- Provider packages duplicate service types to avoid import cycles
- Provider webhooks access db directly, bypassing services
- `packages/api` is awkward - it's mostly implementation that belongs in server
- Shuffling code between packages adds friction to feature work

## Target State

```
apps/
  server/
    src/
      providers/
        fal/           # create.ts, webhook.ts
        runware/       # create.ts, webhook.ts
      services/        # GenerationService, StorageService
      router.ts        # oRPC router, exports AppRouter type
  web/
    # imports type { AppRouter } from server

packages/
  db/                  # Drizzle schema (server-only)
  env/                 # Env types (leave as-is)
```

**What changes:**

- Provider code moves into server as folders
- `packages/api` absorbed into server
- `packages/provider-*` deleted
- Web imports `AppRouter` type from server (type-only, no runtime cycle)
- All mutations go through services

## Migration

### Phase 1: Move Providers into Server

Move provider code from packages into `apps/server/src/providers/`.

**Tasks:**

- [ ] Create `apps/server/src/providers/fal/` with create.ts, webhook.ts
- [ ] Create `apps/server/src/providers/runware/` with create.ts, webhook.ts
- [ ] Update imports in router
- [ ] Delete `packages/provider-fal/` and `packages/provider-runware/`

### Phase 2: Absorb API Package

Move routers and procedures from `packages/api` into server.

**Tasks:**

- [ ] Move `packages/api/src/routers/*` to `apps/server/src/router/`
- [ ] Move procedure definitions (publicProcedure, apiKeyProcedure) into server
- [ ] Export `AppRouter` type from server
- [ ] Update web to import from server
- [ ] Delete `packages/api/`

### Phase 3: Refactor Webhooks to Use Services

Webhooks currently access db directly. Route through services instead.

**Tasks:**

- [ ] Add `complete()` method to GenerationService
- [ ] Add `StorageService` for R2 operations
- [ ] Refactor webhook handlers to use services
- [ ] Remove direct db imports from webhook code

### Phase 4: Clean Up

- [ ] Update CLAUDE.md files
- [ ] Verify all type exports work for web
- [ ] Run checks, fix any issues

## Service Layer

From `notes/provider-system-refactor.md`, the expanded service interface:

```typescript
type GenerationService = {
  // Queries
  get(id: string): Promise<Generation | null>

  // Commands
  create(input: CreateInput): Promise<{ id: string; slug: string | null }>
  markSubmitted(id: string, requestId: string, metadata?: Record<string, unknown>): Promise<void>
  complete(id: string, result: CompletionResult): Promise<void>
  fail(id: string, error: GenerationError): Promise<void>
}

type StorageService = {
  put(id: string, data: ArrayBuffer, contentType: string): Promise<void>
  get(id: string): Promise<{ data: ReadableStream; contentType: string } | null>
  delete(id: string): Promise<void>
}
```

Services are created per-request via Hono middleware, injected into context.

## Why Not a Contract Package?

oRPC supports a contract-first pattern with `@orpc/contract`. This is useful when:

- Multiple implementations of the same contract
- External consumers need the contract without implementation
- Strict separation is architecturally required

We have none of these. One server, one client, internal project. Exporting `AppRouter` type from server is simpler and achieves the same goal.

## Related

- `notes/provider-system-refactor.md` - Service layer details, error handling
