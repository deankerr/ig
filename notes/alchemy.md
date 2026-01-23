# Alchemy

TypeScript-native infrastructure-as-code for Cloudflare. Resources are async functions - no DSL, no YAML, no separate CLI.

## Quick Reference

```bash
bun run deploy                    # Deploy to default stage (dev)
ALCHEMY_STAGE=prod bun run deploy # Deploy to production
bun run dev                       # Local development with Miniflare
bun alchemy destroy               # Delete all resources for current stage
```

## Core Concepts

### Resources as Async Functions

Every Cloudflare resource is an async function that returns a typed object:

```typescript
const db = await D1Database("database", { migrationsDir: "..." });
const bucket = await R2Bucket("generations");
const server = await Worker("server", { bindings: { DB: db, BUCKET: bucket } });
```

Resources are **memoized** - calling the same resource twice returns the same instance.

### Naming Convention

Resources are named `{app}-{resource}-{stage}`:

- App name: `"ig"` (from `alchemy("ig")`)
- Resource name: First parameter to resource function
- Stage: From `ALCHEMY_STAGE` env var or defaults

Example: `D1Database("database")` with stage `dev` → `ig-database-dev`

### The App Lifecycle

```typescript
const app = await alchemy("ig", { stage, stateStore: ... });

// Define resources...
const db = await D1Database("database", { ... });
const server = await Worker("server", { ... });

// MUST call finalize - handles orphan cleanup
await app.finalize();
```

`finalize()` detects resources that were removed from code and deletes them.

## Stages (Multi-Environment)

Stages isolate deployments. Each stage has:

- Separate Cloudflare resources (`ig-server-dev` vs `ig-server-prod`)
- Separate state (local or remote)
- Same secrets (from `.env`)

### Stage Resolution Order

1. `--stage` CLI flag
2. `ALCHEMY_STAGE` environment variable
3. `STAGE` environment variable
4. System username (`$USER`)
5. Default: `"dev"`

Deploy commands:

- `bun run deploy` → stage `dev`
- `ALCHEMY_STAGE=prod bun run deploy` → stage `prod`

## State Management

Alchemy tracks what resources exist in **state**. State contains:

- Resource IDs and configuration
- Encrypted secrets
- Deployment metadata

### State Storage Options

| Store                  | Location                | Use Case                               |
| ---------------------- | ----------------------- | -------------------------------------- |
| `FileSystemStateStore` | Local `.alchemy/` dir   | Default, simple projects               |
| `CloudflareStateStore` | Worker + Durable Object | **Recommended** - survives local wipes |
| `D1StateStore`         | D1 database             | Alternative remote storage             |
| `R2RestStateStore`     | R2 bucket               | Object storage preference              |
| `SQLiteStateStore`     | Local SQLite file       | Queryable local state                  |

### CloudflareStateStore (What We Use)

```typescript
import { CloudflareStateStore } from "alchemy/state";

const app = await alchemy("ig", {
  stage,
  stateStore: (scope) => new CloudflareStateStore(scope, {
    scriptName: `ig-alchemy-state-${stage}`,
  }),
});
```

**Requirements:**

- `ALCHEMY_STATE_TOKEN` env var (generate with `openssl rand -base64 32`)
- Same token for all deployments on your Cloudflare account

**Benefits:**

- State persists even if local files are deleted
- Works with CI/CD (no local state to manage)
- Separate state per stage

### State Recovery

If state is lost but resources exist, use `adopt: true`:

```typescript
const db = await D1Database("database", {
  adopt: true, // Takes ownership of existing ig-database-dev
  migrationsDir: "...",
});
```

This imports existing resources into state instead of trying to create duplicates.

## Environment Variables

### Loading

Alchemy loads env vars via dotenv in `alchemy.run.ts`:

```typescript
config({ path: "./.env" });           // packages/infra/.env (Alchemy config)
config({ path: "../../apps/server/.env" }); // Secrets
```

### Two Types of Bindings

**Public values** - visible in logs and state:

```typescript
CORS_ORIGIN: alchemy.env.CORS_ORIGIN!,
```

**Secrets** - encrypted in state with AES-256-GCM:

```typescript
API_KEY: alchemy.secret.env.API_KEY!,
```

Secrets require `ALCHEMY_PASSWORD` env var for encryption/decryption.

### Our Pattern: Derived URLs

Instead of per-environment `.env` files, we derive URLs from stage:

```typescript
const stage = process.env.ALCHEMY_STAGE ?? "dev";
const cfSubdomain = process.env.CF_WORKERS_SUBDOMAIN; // e.g., "dean-kerr"

const webUrl = `https://ig-web-${stage}.${cfSubdomain}.workers.dev`;
const serverUrl = `https://ig-server-${stage}.${cfSubdomain}.workers.dev`;

// Use in bindings:
bindings: {
  CORS_ORIGIN: webUrl,
  WEBHOOK_URL: `${serverUrl}/webhooks/fal`,
  BETTER_AUTH_URL: serverUrl,
  // Secrets still from .env:
  API_KEY: alchemy.secret.env.API_KEY!,
}
```

**Result:** Same `.env` files work for all stages. Only secrets need to be in `.env`.

## Resource Types

### D1Database

```typescript
const db = await D1Database("database", {
  adopt: true,
  migrationsDir: "../../packages/db/src/migrations",
});
```

- Migrations run automatically on deploy
- Drizzle tracks applied migrations (safe to run multiple times)
- `adopt: true` imports existing database

### R2Bucket

```typescript
const bucket = await R2Bucket("generations", {
  adopt: true,
  location: "OC", // Optional: geographic hint (APAC, ENAM, WEUR, etc.)
});
```

- **Cannot delete non-empty buckets** - get 409 Conflict
- Workaround: Empty via dashboard or rename resource (creates new bucket)

### Worker

```typescript
const server = await Worker("server", {
  adopt: true,
  cwd: "../../apps/server",
  entrypoint: "src/index.ts",
  compatibility: "node",
  observability: { enabled: true, headSamplingRate: 1 },
  bindings: {
    DB: db,                    // D1 binding
    BUCKET: bucket,            // R2 binding
    SECRET: alchemy.secret.env.SECRET!, // Encrypted
    PUBLIC: alchemy.env.PUBLIC!,        // Plain text
  },
  dev: { port: 3000 },
});
```

### Vite (Static Sites)

```typescript
const web = await Vite("web", {
  adopt: true,
  cwd: "../../apps/web",
  assets: "dist",
  bindings: {
    VITE_SERVER_URL: serverUrl,
  },
});
```

- Runs build in `cwd`
- Deploys `assets` directory as Cloudflare Pages
- Bindings become build-time environment variables

## Type-Safe Bindings

Types flow from `alchemy.run.ts` to your Worker code:

**packages/env/env.d.ts:**

```typescript
import { type server } from "@ig/infra/alchemy.run";

export type CloudflareEnv = typeof server.Env;

declare module "cloudflare:workers" {
  namespace Cloudflare {
    export interface Env extends CloudflareEnv {}
  }
}
```

**In your Worker:**

```typescript
import { env } from "cloudflare:workers";

env.DB;                 // Typed as D1Database
env.GENERATIONS_BUCKET; // Typed as R2Bucket
env.API_KEY;            // Typed as string
```

## Local Development

```bash
bun run dev  # Starts Miniflare-based local environment
```

- D1: In-memory SQLite
- R2: Local filesystem simulation
- Workers: Miniflare emulation

**Note:** We primarily use remote deployment for dev because webhooks require public URLs. Local dev is available but rarely used.

## Common Operations

### Fresh Deployment

```bash
bun run deploy
```

### Deploy to Different Stage

```bash
ALCHEMY_STAGE=prod bun run deploy
```

### Destroy All Resources

```bash
bun alchemy destroy  # For current stage
ALCHEMY_STAGE=prod bun alchemy destroy  # For specific stage
```

### Recover from Lost State

1. Add `adopt: true` to all resources
2. Deploy - Alchemy imports existing resources
3. Optionally remove `adopt: true` after recovery

## Gotchas

1. **Resource renames create new resources** - Old resource becomes orphaned
2. **R2 buckets must be empty to delete** - 409 Conflict otherwise
3. **State token must be consistent** - Same `ALCHEMY_STATE_TOKEN` across all deploys
4. **finalize() is required** - Forgetting it leaves orphaned resources
5. **Miniflare ≠ Production** - Some edge cases differ from real Cloudflare

## File Reference

```
packages/infra/
├── alchemy.run.ts    # Infrastructure definition
├── .env              # ALCHEMY_PASSWORD, ALCHEMY_STATE_TOKEN, CF_WORKERS_SUBDOMAIN
└── .alchemy/         # Local state cache (can be deleted if using remote state)

apps/server/.env      # BETTER_AUTH_SECRET, FAL_KEY, API_KEY (secrets only)
apps/web/.env         # VITE_SERVER_URL (for local Vite dev)
```

## Resources

- [Alchemy Docs](https://alchemy.run)
- [Alchemy GitHub](https://github.com/alchemy-run/alchemy)
- [Cloudflare D1 Docs](https://developers.cloudflare.com/d1/)
- [Cloudflare R2 Docs](https://developers.cloudflare.com/r2/)
