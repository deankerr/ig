import alchemy from "alchemy"
import { Ai, D1Database, Images, R2Bucket, Vite, Worker, Workflow } from "alchemy/cloudflare"
import { CloudflareStateStore } from "alchemy/state"
import { config } from "dotenv"

config({ path: "./.env" })

// Default to "dev" to match existing deployed resources (ig-*-dev)
// Use ALCHEMY_STAGE=prod for production deployment
const stage = process.env.ALCHEMY_STAGE ?? "dev"
const isProd = stage.startsWith("prod")
console.log("isProd:", isProd)

// Domain configuration from environment (only needed for prod)
const prodServerDomain = process.env.PROD_SERVER_DOMAIN
const prodWebDomain = process.env.PROD_WEB_DOMAIN

if (isProd && (!prodServerDomain || !prodWebDomain)) {
  throw new Error("PROD_SERVER_DOMAIN and PROD_WEB_DOMAIN must be set for production deployment")
}

// Compute server public URL before worker creation (needed for webhooks)
const cfWorkersSubdomain = process.env.CF_WORKERS_SUBDOMAIN
if (!isProd && !cfWorkersSubdomain) {
  throw new Error("CF_WORKERS_SUBDOMAIN must be set for dev deployment")
}
const serverPublicUrl = isProd
  ? `https://${prodServerDomain}`
  : `https://ig-server-${stage}.${cfWorkersSubdomain}.workers.dev`

function getWorkerUrl(worker: Awaited<ReturnType<typeof Worker>>): string {
  if (worker.domains?.[0]) {
    return `https://${worker.domains[0].name}`
  }

  if (!worker.url) {
    throw new Error(`Worker ${worker.name} has no URL or domain`)
  }

  return worker.url.replace(/\/$/, "")
}

const app = await alchemy("ig", {
  stage,
  stateStore: (scope) =>
    new CloudflareStateStore(scope, {
      scriptName: `ig-alchemy-state`,
    }),
})

const db = await D1Database("database", {
  migrationsDir: "../../packages/db/src/migrations",
  adopt: true,
})

const generationsBucket = await R2Bucket("generations", {
  empty: !isProd,
  adopt: true,
})

const images = Images()

const ai = Ai()

const modelSyncWorkflow = Workflow("model-sync-workflow", {
  className: "ModelSyncWorkflow",
})

// Server first - web depends on its URL
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
    AI: ai,
    FAL_KEY: alchemy.secret.env.FAL_KEY!,
    API_KEY: alchemy.secret.env.API_KEY!,
    MODEL_SYNC_WORKFLOW: modelSyncWorkflow,
    PUBLIC_URL: serverPublicUrl,
  },
  crons: ["0 4 * * *"],
  dev: {
    port: 3000,
    tunnel: true, // create remote worker tunnel
  },
  url: !isProd, // workers.dev
  domains: isProd ? [{ domainName: prodServerDomain!, adopt: true }] : undefined,
  adopt: true,
})

export const web = await Vite("web", {
  cwd: "../../apps/web",
  assets: "dist",
  bindings: {
    VITE_SERVER_URL: getWorkerUrl(server),
    VITE_BUILD_ID: process.env.VITE_BUILD_ID ?? Date.now().toString(),
  },
  url: !isProd, // workers.dev
  domains: isProd ? [{ domainName: prodWebDomain!, adopt: true }] : undefined,
  adopt: true,
})

console.log(`Server: ${getWorkerUrl(server)}`)
console.log(`Web:    ${getWorkerUrl(web)}`)

await app.finalize()
