// Manual Env declaration — Alchemy's inferred `typeof server.Env` triggers TS2589
// (excessively deep type instantiation) due to its Bound<T> conditional type chain.
// Keep this in sync with bindings in packages/infra/alchemy.run.ts.

declare global {
  interface Env {
    AI: Ai
    DATABASE: D1Database
    ARTIFACTS_BUCKET: R2Bucket
    IMAGES: ImagesBinding
    INFERENCE_DO: DurableObjectNamespace

    OLDDB: D1Database
    OLDBUCKET: R2Bucket

    API_KEY: string
    PUBLIC_URL: string
    RUNWARE_KEY: string
  }
}

declare module 'cloudflare:workers' {
  namespace Cloudflare {
    export interface Env {
      AI: Ai
      DATABASE: D1Database
      ARTIFACTS_BUCKET: R2Bucket
      IMAGES: ImagesBinding
      INFERENCE_DO: DurableObjectNamespace

      OLDDB: D1Database
      OLDBUCKET: R2Bucket

      API_KEY: string
      PUBLIC_URL: string
      RUNWARE_KEY: string
    }
  }
}

export {}
