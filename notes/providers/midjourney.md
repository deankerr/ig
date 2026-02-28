# Midjourney (via Runware)

Provider-specific settings path: `providerSettings.midjourney`

## Provider Settings

### `quality`

- Path: `providerSettings.midjourney.quality`
- Type: `"0.25" | "0.5" | "1" | "2"`, default `1`
- Controls GPU compute effort. Higher = more detail, slower.
- V7 only supports `1` and `2`.

### `stylize`

- Path: `providerSettings.midjourney.stylize`
- Type: `integer`, min 0, max 1000, default 100
- Lower = more literal prompt following; higher = more artistic interpretation
- Sweet spot: 50-500

### `chaos`

- Path: `providerSettings.midjourney.chaos`
- Type: `integer`, min 0, max 100, default 0
- Controls variation/unpredictability. 0 = consistent, 50+ = highly varied.

### `weird`

- Path: `providerSettings.midjourney.weird`
- Type: `integer`, min 0, max 3000, default 0
- Adds surreal/experimental characteristics. Practical range: 100-1000.
- 2000+ produces extreme, often impractical results.

### `niji`

- Path: `providerSettings.midjourney.niji`
- Type: `"0" | "5" | "6" | "close"`, default `"close"`
- Selects rendering engine. `5`/`6` = anime-style Niji models. `close`/`0` = standard.

---

## Image Models

All Midjourney models share these constraints:

- **numberResults**: must be a multiple of 4 (4, 8, 12, 16, 20; default 4)
- **Reference images**: up to 1
- **Provider settings**: `quality`, `stylize`, `chaos`, `weird`, `niji`

**Dimensions (required — fixed set, shared across all models):**

| Ratio       | WxH       |
| ----------- | --------- |
| 1:1         | 1024x1024 |
| 4:3 / 3:4   | 1232x928  |
| 3:2 / 2:3   | 1344x896  |
| 16:9 / 9:16 | 1456x816  |
| 21:9        | 1680x720  |

### Midjourney V6

- AIR ID: `midjourney:1@1`
- Workflows: text-to-image, image-to-image
- Prompt: 1-2000 chars

### Midjourney V6.1

- AIR ID: `midjourney:2@1`
- Workflows: text-to-image, image-to-image
- Prompt: 1-2000 chars
- Improvements over V6: lighting, spatial coherence, tonal balance, sharper detail, better anatomy, reduced artifacts, improved text readability

### Midjourney V7

- AIR ID: `midjourney:3@1`
- Workflows: text-to-image, image-to-image
- Prompt: 1-2000 chars
- Quality param restricted to `1` or `2` only
- Improvements: realism, texture fidelity, lighting, natural language understanding, photographic quality
