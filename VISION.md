# ig

A microservice for generative AI inference, artifact storage, and retrieval. The shared backend for my AI-powered apps.

## Vision

ig handles the boilerplate of working with generative AI so my apps don't have to. Submit a request, get an artifact back. The service manages the async complexity, stores everything, and provides a unified API regardless of what model or modality is being used.

Consumers include traditional web apps, Discord bots, CLI tools - anything I build that needs to generate images, video, audio, or run vision models. ig is not end-user facing; it's infrastructure for my projects.

## What It Does

- **Inference orchestration** via Runware - text-to-image, image-to-image, image-to-video, vision models, anything Runware supports
- **Artifact storage** - outputs stored in R2, inputs and metadata in D1
- **Full provenance** - every artifact retains its input parameters, endpoint, timing, metrics
- **Flexible tagging** - consumers define their own organization schemes
- **Unified API** - same interface regardless of endpoint or modality

## Design Philosophy

**Artifacts are the point.** The inference job is transient plumbing. What matters is the library of generated content you're building over time.

**Store everything, ask questions later.** R2 is cheap. Keep inputs, outputs, errors, metrics. You'll want them eventually.

**Simple until proven otherwise.** No complex features until there's a real need. Iterate based on actual usage.

## Stack

- **Cloudflare Workers** - API, webhook handlers
- **D1** - Artifact records, queries
- **R2** - Blob storage for outputs

## Boundaries

ig is deliberately limited in scope:

- **Not multi-user** - no auth, no permissions, no tenancy. Consumers handle their own users.
- **Not a workflow engine** - single inference requests only. Chaining is consumer's job.
- **Not real-time** - async by nature. Consumers poll or wait for completion.

## Hypothetical Consumer Apps

- **Semantic search** - Embeddings, vector storage, similarity queries
- **Multi-User Generative AI App** - Handles all of the user management aspects
- **Discord bot** - Uses tags to group by channel, user, etc.

**Resources:**

- Endpoint schemas: `https://fal.ai/api/openapi/queue/openapi.json?endpoint_id={endpoint}`
- [Queue API docs](https://docs.fal.ai/model-apis/model-endpoints/queue.md)
- [Webhooks](https://docs.fal.ai/model-apis/model-endpoints/webhooks)
- [Usage API](https://docs.fal.ai/platform-apis/v1/models/usage)
