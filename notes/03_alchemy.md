# Alchemy Notes

Notes on working with Alchemy for Cloudflare infrastructure as code.

## What is Alchemy?

Alchemy is TypeScript-native infrastructure-as-code for Cloudflare. Resources are async functions that run in any JS environment - no DSL, no YAML, no separate state backend.

```typescript
const app = await alchemy("ig");
const db = await D1Database("database", { migrationsDir: "..." });
const bucket = await R2Bucket("generations");
const server = await Worker("server", { bindings: { DB: db, BUCKET: bucket } });
await app.finalize(); // cleans up orphaned resources
```

## Local vs Remote Resources

Alchemy manages resources in two contexts:

### Local Development (`bun alchemy dev`)

- Uses Miniflare under the hood
- D1 database is in-memory
- R2 bucket is local filesystem simulation
- Resources created fresh each dev session
- State stored in `.alchemy/ig/` directory locally

### Remote Deployment (`bun alchemy deploy`)

- Creates actual Cloudflare resources
- D1 is real Cloudflare database
- R2 is real bucket in Cloudflare
- Resources persist between deployments
- State tracked in `.alchemy/ig/state.json`

### State Management

The `.alchemy/` directory contains:

- Resource state (what exists, configuration)
- Deployment metadata
- Local dev environment state

This can be committed to git or gitignored depending on team workflow preferences. We currently commit it.

## Resource Lifecycle

### Creating Resources

Resources are defined in `packages/infra/alchemy.run.ts`:

```typescript
const generationsBucket = await R2Bucket("generations");
```

The first parameter is the **resource name** (unique identifier within your app). Alchemy uses this to track the resource.

### Destroying Resources

```bash
bun alchemy destroy
```

This command:

- Deletes all Cloudflare resources defined in your alchemy.run.ts
- Removes them from state
- Does NOT delete local .alchemy state files

**Important limitation:** R2 buckets must be empty to delete. If you get a 409 error, the bucket has files in it. Options:

1. Manually empty via Cloudflare dashboard
2. Change the resource name to create a new bucket (old one remains orphaned)

### Updating Resources

When you change resource configuration in `alchemy.run.ts`:

- Next deploy/dev will update the resource
- Alchemy automatically detects changes
- No manual migration needed

Example: Renaming a binding automatically updates the Worker configuration on next deploy.

## Resource Types We Use

### D1Database

```typescript
const db = await D1Database("database", {
  migrationsDir: "../../packages/db/src/migrations",
});
```

**Key options:**

- `migrationsDir`: Path to Drizzle migration files (run automatically on deploy)
- Resource is created on first deploy
- Database name in Cloudflare will be prefixed with app name and stage: `ig-database-dean`

**Migration handling:**

- Migrations run automatically when deploying
- Alchemy detects new migration files
- Safe to run multiple times (Drizzle tracks applied migrations)

### R2Bucket

```typescript
const generationsBucket = await R2Bucket("generations");
```

**Key options:**

- `location`: Geographic hint (e.g., "APAC", "ENAM") - we didn't set this, defaults to automatic
- `adopt: true`: Use existing bucket if name matches (useful for importing existing resources)

**Naming:**

- Actual Cloudflare bucket name: `ig-generations-dean` (app-name-stage pattern)
- Resource name in code: `"generations"`

**Common issue:** Can't delete non-empty buckets. Workaround is to rename the resource to create a fresh one.

### Worker

```typescript
const server = await Worker("server", {
  cwd: "../../apps/server",
  entrypoint: "src/index.ts",
  compatibility: "node",
  observability: {
    enabled: true,
    headSamplingRate: 1,
  },
  bindings: {
    DB: db,
    GENERATIONS_BUCKET: generationsBucket,
    CORS_ORIGIN: alchemy.env.CORS_ORIGIN!,
    BETTER_AUTH_SECRET: alchemy.secret.env.BETTER_AUTH_SECRET!,
    // ... other env vars
  },
  dev: {
    port: 3000,
  },
});
```

**Bindings:**

- Resources (D1, R2): Pass the resource object directly
- Regular env vars: `alchemy.env.VAR_NAME`
- Secrets: `alchemy.secret.env.VAR_NAME`

**Dev configuration:**

- `port`: Local development port
- Alchemy automatically proxies requests to Miniflare

**Observability:**

- `enabled: true`: Turn on Cloudflare tracing
- `headSamplingRate: 1`: Sample 100% of requests (useful in dev/early production)

### Vite (Static Site)

```typescript
const web = await Vite("web", {
  cwd: "../../apps/web",
  assets: "dist",
  bindings: {
    VITE_SERVER_URL: alchemy.env.VITE_SERVER_URL!,
  },
});
```

**How it works:**

- Runs `npm run build` (or `bun run build`) in the cwd
- Deploys `dist/` directory as Cloudflare Pages
- `bindings` become environment variables in the build process

## Type Safety with Bindings

Alchemy provides type-safe bindings through TypeScript inference:

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

This means:

1. Define bindings in `alchemy.run.ts`
2. Types automatically inferred in your Worker code
3. No manual type definitions needed
4. TypeScript knows exactly what `env.GENERATIONS_BUCKET` is

## Commands

```bash
# Local development
bun alchemy dev              # Start all resources locally

# Deployment
bun alchemy deploy           # Deploy to Cloudflare

# Cleanup
bun alchemy destroy          # Delete all remote resources

# Other
bun alchemy run              # Read-only mode (doesn't create resources)
bun alchemy configure        # Set up provider credentials
bun alchemy login cloudflare # Authenticate with Cloudflare
```

## Environment Variables

Alchemy loads env vars from:

1. Root `packages/infra/.env`
2. Any additional `.env` files you explicitly load in `alchemy.run.ts`

Our setup in `alchemy.run.ts`:

```typescript
import { config } from "dotenv";

config({ path: "./.env" });
config({ path: "../../apps/web/.env" });
config({ path: "../../apps/server/.env" });
```

This lets us share env vars across the monorepo.

## Common Patterns

### Resource Name Changes = Fresh Resources

When you rename a resource:

```typescript
// Before
const artifactsBucket = await R2Bucket("artifacts");

// After
const generationsBucket = await R2Bucket("generations");
```

Alchemy sees this as a new resource and:

1. Creates `ig-generations-dean` bucket
2. Leaves `ig-artifacts-dean` bucket (now orphaned)
3. You must manually clean up old bucket

**Workaround:** Update binding references, deploy, then destroy old resource manually.

### Migrations in Pre-Production

Since our project is pre-production with no data to preserve:

- We can freely destroy and recreate resources
- No need for backwards compatibility
- Clear old migrations and start fresh when needed
- This is the RIGHT time to make breaking changes

## Gotchas

1. **Empty R2 buckets before destroy** - Non-empty buckets return 409 Conflict
2. **Resource names matter** - Changing a name creates a new resource, doesn't rename
3. **State is local** - `.alchemy/` directory tracks what resources exist
4. **Bindings are typed** - Changes to bindings automatically update TypeScript types
5. **Miniflare for dev** - Local dev isn't 100% identical to production Cloudflare

## Useful Resources

- [Alchemy Docs](https://alchemy.run) - Main documentation
- [Cloudflare D1 Docs](https://developers.cloudflare.com/d1/) - D1 specifics
- [Cloudflare R2 Docs](https://developers.cloudflare.com/r2/) - R2 specifics
- Alchemy GitHub: github.com/sam-goodwin/alchemy

## Comparison to Alternatives

**vs Terraform:**

- Alchemy: TypeScript, no state backend, resources are code
- Terraform: HCL, separate state, more mature ecosystem

**vs Wrangler (Cloudflare CLI):**

- Alchemy: Declarative, infrastructure as code, type-safe
- Wrangler: Imperative, config files (wrangler.toml), CLI-driven

**vs Pulumi:**

- Alchemy: Cloudflare-specific, simpler, no cloud state
- Pulumi: Multi-cloud, more complex, cloud state management

Alchemy feels most like "just TypeScript" - great for TypeScript-first teams working primarily with Cloudflare.
