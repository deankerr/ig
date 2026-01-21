import alchemy from "alchemy";
import { D1Database, R2Bucket, Vite, Worker } from "alchemy/cloudflare";
import { CloudflareStateStore } from "alchemy/state";
import { config } from "dotenv";

config({ path: "./.env" });
config({ path: "../../apps/server/.env" });

// Default to "dev" to match existing deployed resources (ig-*-dev)
// Use ALCHEMY_STAGE=prod for production deployment
const stage = process.env.ALCHEMY_STAGE ?? "dev";

// Derive URLs from stage - no need for per-environment .env files
const cfSubdomain = process.env.CF_WORKERS_SUBDOMAIN;
if (!cfSubdomain) throw new Error("CF_WORKERS_SUBDOMAIN is required");
const webUrl = `https://ig-web-${stage}.${cfSubdomain}.workers.dev`;
const serverUrl = `https://ig-server-${stage}.${cfSubdomain}.workers.dev`;

const app = await alchemy("ig", {
  stage,
  stateStore: (scope) =>
    new CloudflareStateStore(scope, {
      scriptName: `ig-alchemy-state-${stage}`,
    }),
});

const db = await D1Database("database", {
  adopt: true, // Adopt existing ig-database-dev
  migrationsDir: "../../packages/db/src/migrations",
});

const generationsBucket = await R2Bucket("generations", {
  adopt: true, // Adopt existing ig-generations-dev
});

export const web = await Vite("web", {
  adopt: true, // Adopt existing ig-web-dev
  cwd: "../../apps/web",
  assets: "dist",
  bindings: {
    VITE_SERVER_URL: serverUrl,
  },
});

export const server = await Worker("server", {
  adopt: true, // Adopt existing ig-server-dev
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
    CORS_ORIGIN: webUrl,
    BETTER_AUTH_SECRET: alchemy.secret.env.BETTER_AUTH_SECRET!,
    BETTER_AUTH_URL: serverUrl,
    FAL_KEY: alchemy.secret.env.FAL_KEY!,
    WEBHOOK_URL: `${serverUrl}/webhooks/fal`,
    API_KEY: alchemy.secret.env.API_KEY!,
  },
  dev: {
    port: 3000,
  },
});

console.log(`Web    -> ${web.url}`);
console.log(`Server -> ${server.url}`);

await app.finalize();
