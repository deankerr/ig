# ig

Generative AI inference, artifact storage, and retrieval. Shared backend for my AI-powered apps.

See [VISION.md](VISION.md) for design philosophy.

## Stack

Cloudflare Workers + D1 + R2, Hono + oRPC, Drizzle ORM, React 19 + TanStack + shadcn/ui, Alchemy IaC.

## Commands

```bash
bun run check    # type check + lint + format
bun run deploy   # deploy to Cloudflare via Alchemy
```
