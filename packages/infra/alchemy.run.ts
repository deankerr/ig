import alchemy from 'alchemy'
import { D1Database, R2Bucket, Vite, Worker } from 'alchemy/cloudflare'
import { config } from 'dotenv'

config({ path: './.env' })
config({ path: '../../apps/web/.env' })
config({ path: '../../apps/server/.env' })

const app = await alchemy('ig')

const db = await D1Database('database', {
  migrationsDir: '../../packages/db/src/migrations',
})

const artifactsBucket = await R2Bucket('artifacts')

export const web = await Vite('web', {
  cwd: '../../apps/web',
  assets: 'dist',
  bindings: {
    VITE_SERVER_URL: alchemy.env.VITE_SERVER_URL!,
  },
})

export const server = await Worker('server', {
  cwd: '../../apps/server',
  entrypoint: 'src/index.ts',
  compatibility: 'node',
  observability: {
    enabled: true,
    headSamplingRate: 1,
  },
  bindings: {
    DB: db,
    ARTIFACTS_BUCKET: artifactsBucket,
    CORS_ORIGIN: alchemy.env.CORS_ORIGIN!,
    BETTER_AUTH_SECRET: alchemy.secret.env.BETTER_AUTH_SECRET!,
    BETTER_AUTH_URL: alchemy.env.BETTER_AUTH_URL!,
    GOOGLE_GENERATIVE_AI_API_KEY: alchemy.secret.env.GOOGLE_GENERATIVE_AI_API_KEY!,
    FAL_KEY: alchemy.secret.env.FAL_KEY!,
    WEBHOOK_URL: alchemy.env.WEBHOOK_URL!,
  },
  dev: {
    port: 3000,
  },
})

console.log(`Web    -> ${web.url}`)
console.log(`Server -> ${server.url}`)

await app.finalize()
