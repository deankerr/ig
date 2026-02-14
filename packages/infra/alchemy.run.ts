import alchemy from 'alchemy'
import {
  Ai,
  D1Database,
  DurableObjectNamespace,
  Images,
  R2Bucket,
  Vite,
  Worker,
} from 'alchemy/cloudflare'
import { CloudflareStateStore } from 'alchemy/state'
import { config } from 'dotenv'

import stageConfig from './config'

config({ path: './.env' })

const app = await alchemy('ig', {
  stateStore: (scope) =>
    new CloudflareStateStore(scope, {
      scriptName: 'ig-alchemy-state',
    }),
})

const productionStages = new Map(Object.entries(stageConfig.production))

const domain = (service: 'server' | 'web') => {
  const stage = productionStages.get(app.stage)
  if (stage) {
    return stage[service].domain
  }

  return `${service}.${app.stage}.${stageConfig.development.baseDomain}`
}

// original - transfer out
const olddb = await D1Database('db', {
  name: 'ig-database-prod-1',
  adopt: true,
  delete: false,
})

const oldbucket = await R2Bucket('generations', {
  name: 'ig-generations-prod-1',
  adopt: true,
  delete: false,
  empty: !productionStages.has(app.stage),
})

// new
const database = await D1Database('database', {
  migrationsDir: '../../packages/db/src/migrations',
})

const artifactsBucket = await R2Bucket('artifacts', {
  empty: !productionStages.has(app.stage),
})

const inferenceDO = DurableObjectNamespace('inference', {
  className: 'InferenceDO',
  sqlite: true,
})

const images = Images()
const ai = Ai()

export const server = await Worker('server', {
  url: false,
  cwd: '../../apps/server',
  entrypoint: 'src/index.ts',
  compatibility: 'node',
  observability: {
    enabled: true,
    headSamplingRate: 1,
  },
  bindings: {
    AI: ai,
    ARTIFACTS_BUCKET: artifactsBucket,
    DATABASE: database,
    INFERENCE_DO: inferenceDO,

    IMAGES: images,

    API_KEY: alchemy.secret.env.API_KEY!,
    PUBLIC_URL: `https://${domain('server')}`,
    RUNWARE_KEY: alchemy.secret.env.RUNWARE_KEY!,

    OLDDB: olddb,
    OLDBUCKET: oldbucket,
  },
  dev: {
    port: 3220,
  },
  domains: [domain('server')],
})

// In dev, Alchemy sets .url to localhost. In deploy, fall back to the domain.
const url = (worker: Awaited<ReturnType<typeof Worker>>) =>
  worker.url?.replace(/\/$/, '') ?? `https://${worker.domains?.[0]?.name}`

export const web = await Vite('web', {
  url: false,
  cwd: '../../apps/web',
  assets: 'dist',
  bindings: {
    VITE_SERVER_URL: process.env.OVERRIDE_SERVER_URL ?? url(server),
    VITE_BUILD_ID: process.env.VITE_BUILD_ID ?? Date.now().toString(),
  },
  domains: [domain('web')],
})

console.log(`Server: ${url(server)}`)
console.log(`Web:    ${url(web)}`, `(-> ${web.bindings.VITE_SERVER_URL})`)

await app.finalize()
