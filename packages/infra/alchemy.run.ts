import alchemy from "alchemy"
import { D1Database, Images, R2Bucket, Vite, Worker, Workflow } from "alchemy/cloudflare"
import { CloudflareStateStore } from "alchemy/state"
import { config } from "dotenv"

config({ path: "./.env" })
config({ path: "../../apps/server/.env" })

// Default to "dev" to match existing deployed resources (ig-*-dev)
// Use ALCHEMY_STAGE=prod for production deployment
const stage = process.env.ALCHEMY_STAGE ?? "dev"
console.log("is dev", stage === "dev")

// Derive URLs from stage - no need for per-environment .env files
const cfSubdomain = process.env.CF_WORKERS_SUBDOMAIN
if (!cfSubdomain) throw new Error("CF_WORKERS_SUBDOMAIN is required")

const serverUrl = process.env.SERVER_URL ?? `https://ig-server-${stage}.${cfSubdomain}.workers.dev`

const app = await alchemy("ig", {
  stage,
  stateStore: (scope) =>
    new CloudflareStateStore(scope, {
      scriptName: `ig-alchemy-state-${stage}`,
    }),
})

const db = await D1Database("database", {
  migrationsDir: "../../packages/db/src/migrations",
  adopt: true,
})

const generationsBucket = await R2Bucket("generations", {
  empty: stage === "dev",
  adopt: true,
})

const images = Images()

const modelSyncWorkflow = Workflow("model-sync-workflow", {
  className: "ModelSyncWorkflow",
})

// Build ID for cache busting - changes each deployment
const buildId = process.env.VITE_BUILD_ID ?? new Date().toISOString().slice(0, 16)

export const web = await Vite("web", {
  cwd: "../../apps/web",
  assets: "dist",
  bindings: {
    VITE_SERVER_URL: serverUrl,
    VITE_BUILD_ID: buildId,
  },
  adopt: true,
})

export const server = await Worker("server", {
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
    IMAGES: images,
    FAL_KEY: alchemy.secret.env.FAL_KEY!,
    WEBHOOK_URL: `${serverUrl}/webhooks/fal`,
    API_KEY: alchemy.secret.env.API_KEY!,
    MODEL_SYNC_WORKFLOW: modelSyncWorkflow,
  },
  crons: ["0 4 * * *"],
  dev: {
    port: 3000,
  },
  adopt: true,
})

console.log(`Web    -> ${web.url}`, `(target: ${serverUrl})`)
console.log(`Server -> ${server.url}`)

await app.finalize()
