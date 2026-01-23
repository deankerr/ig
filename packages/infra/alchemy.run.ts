import alchemy from "alchemy"
import { D1Database, Images, Queue, R2Bucket, Vite, Worker } from "alchemy/cloudflare"
import { CloudflareStateStore } from "alchemy/state"
import { config } from "dotenv"

config({ path: "./.env" })
config({ path: "../../apps/server/.env" })

// Default to "dev" to match existing deployed resources (ig-*-dev)
// Use ALCHEMY_STAGE=prod for production deployment
const stage = process.env.ALCHEMY_STAGE ?? "dev"

// Derive URLs from stage - no need for per-environment .env files
const cfSubdomain = process.env.CF_WORKERS_SUBDOMAIN
if (!cfSubdomain) throw new Error("CF_WORKERS_SUBDOMAIN is required")
const webUrl = `https://ig-web-${stage}.${cfSubdomain}.workers.dev`
const serverUrl = `https://ig-server-${stage}.${cfSubdomain}.workers.dev`

const app = await alchemy("ig", {
  stage,
  stateStore: (scope) =>
    new CloudflareStateStore(scope, {
      scriptName: `ig-alchemy-state-${stage}`,
    }),
})

const db = await D1Database("database", {
  migrationsDir: "../../packages/db/src/migrations",
})

const generationsBucket = await R2Bucket("generations", {})

const images = Images()

const modelSyncQueue = await Queue("model-sync", {
  settings: {
    deliveryDelay: 5, // avoid fal rate limits
  },
})

export const web = await Vite("web", {
  cwd: "../../apps/web",
  assets: "dist",
  bindings: {
    VITE_SERVER_URL: serverUrl,
  },
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
    CORS_ORIGIN: webUrl,
    FAL_KEY: alchemy.secret.env.FAL_KEY!,
    WEBHOOK_URL: `${serverUrl}/webhooks/fal`,
    API_KEY: alchemy.secret.env.API_KEY!,
    MODEL_SYNC_QUEUE: modelSyncQueue,
  },
  crons: ["0 4 * * *"],
  eventSources: [
    {
      queue: modelSyncQueue,
      settings: {
        batchSize: 1,
        maxConcurrency: 1,
        maxRetries: 3,
        retryDelay: 60,
      },
    },
  ],
  dev: {
    port: 3000,
  },
})

console.log(`Web    -> ${web.url}`)
console.log(`Server -> ${server.url}`)

await app.finalize()
