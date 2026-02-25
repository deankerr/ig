# ig

A microservice for generative AI inference, artifact storage, and retrieval. The shared backend for my AI-powered apps.

## Vision

ig handles the boilerplate of working with generative AI so my apps don't have to. Submit a request, get an artifact back. The service manages the async complexity, stores everything, and provides a unified API regardless of what model or modality is being used.

Consumers include traditional web apps, Discord bots, CLI tools - anything I build that needs to generate images, video, audio, or run vision models. ig is not end-user facing; it's infrastructure for my projects.

## What It Does

- **Inference orchestration** via Runware - text-to-image, image-to-image, and other modalities Runware supports
- **Artifact storage** - outputs stored in R2, inputs and metadata in D1
- **Full provenance** - every artifact retains its input parameters, model, timing, cost
- **Admin console** - web UI for browsing artifacts/generations, inspecting metadata, and submitting requests
- **Unified API** - same interface regardless of model or modality

## Design Philosophy

**Artifacts are the point.** The inference job is transient plumbing. What matters is the library of generated content you're building over time.

**Store everything, ask questions later.** R2 is cheap. Keep inputs, outputs, errors, metrics. You'll want them eventually.

**Simple until proven otherwise.** No complex features until there's a real need. Iterate based on actual usage.
