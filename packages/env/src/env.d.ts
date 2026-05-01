// Manual Env declaration — Alchemy's inferred `typeof server.Env` triggers TS2589
// (excessively deep type instantiation) due to its Bound<T> conditional type chain.
// Keep this in sync with bindings in packages/infra/alchemy.run.ts.

declare global {
  interface Env {
    AI: Ai
    CACHE: KVNamespace
    DATABASE: D1Database
    ARTIFACTS_BUCKET: R2Bucket
    IMAGES: ImagesBinding
    INFERENCE_DO: DurableObjectNamespace

    API_KEY: string
    DISCORD_ALLOWED_CHANNEL_IDS: string
    DISCORD_APPLICATION_ID: string
    DISCORD_BOT_TOKEN: string
    DISCORD_GUILD_ID: string
    DISCORD_MODEL_ALLOWLIST: string
    DISCORD_PUBLIC_KEY: string
    IG_API_KEY: string
    IG_BASE_URL: string
    PUBLIC_URL: string
    RUNWARE_KEY: string
  }
}

declare module 'cloudflare:workers' {
  namespace Cloudflare {
    export interface Env {
      AI: Ai
      CACHE: KVNamespace
      DATABASE: D1Database
      ARTIFACTS_BUCKET: R2Bucket
      IMAGES: ImagesBinding
      INFERENCE_DO: DurableObjectNamespace

      API_KEY: string
      DISCORD_ALLOWED_CHANNEL_IDS: string
      DISCORD_APPLICATION_ID: string
      DISCORD_BOT_TOKEN: string
      DISCORD_GUILD_ID: string
      DISCORD_MODEL_ALLOWLIST: string
      DISCORD_PUBLIC_KEY: string
      IG_API_KEY: string
      IG_BASE_URL: string
      PUBLIC_URL: string
      RUNWARE_KEY: string
    }
  }
}

export {}
