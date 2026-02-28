# Black Forest Labs (via Runware)

Provider-specific settings path: `providerSettings.bfl`

## Provider Settings

### `promptUpsampling`

- Path: `providerSettings.bfl.promptUpsampling`
- Type: `boolean`, default `false`
- Auto-enhances prompt with additional descriptive detail without changing intent
- Supported by: all BFL models

### `safetyTolerance`

- Path: `providerSettings.bfl.safetyTolerance`
- Type: `integer`, min 0, max 6, default 2
- 0 = strictest content filtering, 6 = most permissive
- Supported by: all BFL models

### `raw`

- Path: `providerSettings.bfl.raw`
- Type: `boolean`, default `false`
- Bypasses post-processing for more natural output
- Supported by: FLUX.1.1 Pro Ultra only

---

## FLUX.1 Family

### FLUX.1.1 Pro

- AIR ID: `bfl:2@1`
- Workflows: text-to-image
- Prompt: 2-3000 chars
- Dimensions: 256-1440px (width and height)
- Provider settings: `promptUpsampling`, `safetyTolerance`

### FLUX.1.1 Pro Ultra

- AIR ID: `bfl:2@2`
- Workflows: text-to-image
- Prompt: 2-3000 chars
- Up to 4MP output
- Provider settings: `promptUpsampling`, `safetyTolerance`, `raw`

**Dimensions (required — aspect ratio selection, not arbitrary pixels):**

| Ratio       | WxH       |
| ----------- | --------- |
| 1:1         | 2048x2048 |
| 4:3 / 3:4   | 2368x1792 |
| 3:2 / 2:3   | 2496x1664 |
| 16:9 / 9:16 | 2752x1536 |
| 21:9 / 9:21 | 3136x1344 |

### FLUX.1 Fill Pro (Inpainting)

- AIR ID: `bfl:1@2`
- Workflows: inpainting
- Prompt: 2-3000 chars
- Requires: `seedImage` + `maskImage`
- Steps: 15-50 (default 50)
- CFGScale: 1.5-100 (default 60)
- Output dimensions: auto from input image
- Provider settings: `promptUpsampling`, `safetyTolerance`

### FLUX.1 Expand Pro (Outpainting)

- AIR ID: `bfl:1@3`
- Workflows: outpainting
- Prompt: 2-3000 chars
- Requires: `seedImage` + `outpaint` object
- `outpaint`: `{ top, bottom, left, right }` — max 2048px per side
- Steps: 15-50 (default 50)
- CFGScale: 1.5-100 (default 60)
- Output dimensions: auto from input + expansion
- Provider settings: `promptUpsampling`, `safetyTolerance`

### FLUX.1 Kontext [pro]

- AIR ID: `bfl:3@1`
- Workflows: text-to-image, reference-to-image
- Prompt: 2-3000 chars
- Reference images: up to 2
- Provider settings: `promptUpsampling`, `safetyTolerance`

**Dimensions (required — aspect ratio selection, not arbitrary pixels):**

| Ratio       | WxH       |
| ----------- | --------- |
| 1:1         | 1024x1024 |
| 4:3 / 3:4   | 1184x880  |
| 3:2 / 2:3   | 1248x832  |
| 16:9 / 9:16 | 1392x752  |
| 21:9 / 9:21 | 1568x672  |

### FLUX.1 Kontext [max]

- AIR ID: `bfl:4@1`
- Workflows: text-to-image, reference-to-image
- Prompt: 2-3000 chars
- Reference images: up to 2
- Provider settings: `promptUpsampling`, `safetyTolerance`
- Same dimensions as Kontext [pro]

---

## FLUX.2 Family

### FLUX.2 [dev]

- AIR ID: `runware:400@1`
- Workflows: text-to-image, reference-to-image
- Prompt: 1-32000 chars
- Reference images: up to 4
- Dimensions: 512-2048px (multiples of 16)
- Steps: 1-50
- CFGScale: 1-20 (default 4)
- Acceleration: `"none"` | `"low"` | `"medium"` | `"high"` (default `"medium"`)
- No provider-specific settings (open weights, hosted by Runware)

### FLUX.2 [klein] Family

All klein models share these specs:

- Workflows: text-to-image, image-to-image, reference-to-image, image-editing
- Prompt: 1-10000 chars
- Negative prompt: 1-10000 chars (optional)
- Reference images: up to 4
- Dimensions: 128-2048px (multiples of 16)
- Steps: 1-50 (distilled default 4, base default 28)
- CFGScale: 1-20 (default 3.5)
- True CFG Scale (`settings.trueCFGScale`): 1-20 (default 4)
- Acceleration: `"none"` | `"low"` | `"medium"` | `"high"` (default `"high"`)

Note: when `steps` is set without `acceleration`, acceleration is not applied.

| Variant       | AIR ID          | Notes                               |
| ------------- | --------------- | ----------------------------------- |
| klein 9B      | `runware:400@2` | 4-step distilled, sub-second        |
| klein 9B Base | `runware:400@3` | Undistilled, for fine-tuning        |
| klein 4B      | `runware:400@4` | 4-step distilled, ultra-low latency |
| klein 4B Base | `runware:400@5` | Undistilled, compact                |

### FLUX.2 [pro]

- AIR ID: `bfl:5@1`
- Workflows: text-to-image, reference-to-image
- Prompt: 1-32000 chars
- Reference images: up to 9 (total input capacity: 9MP)
- Dimensions: 256-2048px, arbitrary (multiples of 16)
- numberResults: 1 only (no batch generation)
- No steps/CFGScale control (model-managed)
- Provider settings: `promptUpsampling`, `safetyTolerance`

### FLUX.2 [max]

- AIR ID: `bfl:7@1`
- Workflows: text-to-image, reference-to-image
- Prompt: 1-32000 chars
- Reference images: up to 8
- Grounded generation: integrates real-time web info into output
- Dimensions: 256-2048px, arbitrary (multiples of 16)
- numberResults: 1 only (no batch generation)
- No steps/CFGScale control (model-managed)
- Provider settings: `promptUpsampling`, `safetyTolerance`

### FLUX.2 [flex]

- AIR ID: `bfl:6@1`
- Workflows: text-to-image, reference-to-image
- Prompt: 1-32000 chars
- Reference images: up to 10 (total input capacity: 14MP)
- Dimensions: 256-2048px, arbitrary (multiples of 16)
- Steps: 1-50
- CFGScale: 1.5-10 (default 2.5) — narrower range than dev/klein
- Best for typography and text rendering
- Provider settings: `promptUpsampling`, `safetyTolerance`
