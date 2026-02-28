# ByteDance (via Runware)

Provider-specific settings path: `providerSettings.bytedance`

## Shared Image Settings

### `maxSequentialImages`

- Path: `providerSettings.bytedance.maxSequentialImages`
- Type: `integer`, min 1, max 15
- Generates coherent image sequences (storyboards, comics)
- Combined limit: reference images + sequential images <= 15
- Model may return fewer images than requested

### `optimizePromptMode`

- Path: `providerSettings.bytedance.optimizePromptMode`
- Type: `"standard" | "fast"`, default `"standard"`
- `fast` = faster, lower quality; `standard` = slower, higher quality
- Supported by: Seedream 4.5, Seedream 5.0 Lite

---

## Image Models

### SeedEdit 3.0

- AIR ID: `bytedance:4@1`
- Workflows: image-to-image only
- Prompt: 2-500 chars

| Param             | Constraint                                      |
| ----------------- | ----------------------------------------------- |
| Input image       | 300-6000px per side, 10MB max                   |
| CFGScale          | 1-10 (default 5.5)                              |
| Image input       | `referenceImages: [url]` — exactly 1 (required) |
| Output dimensions | inherits aspect ratio from reference, up to 4K  |

Provider settings: none.

---

### Seedream 4.0

- AIR ID: `bytedance:5@0`
- Workflows: text-to-image, image-to-image
- Prompt: 1-2000 chars
- Image input: `referenceImages: string[]` — up to 14

**Dimension constraints:** total pixels between ~921,600 (960x960) and 16,777,216 (4096x4096). Arbitrary dimensions within this range are accepted (not limited to the recommended set below). Confirmed: 1024x1536 works.

**Recommended dimensions:**

| Tier | 1:1       | 4:3 / 3:4 | 16:9 / 9:16 | 3:2 / 2:3 | 21:9      |
| ---- | --------- | --------- | ----------- | --------- | --------- |
| 1K   | 1024x1024 | —         | —           | —         | —         |
| 2K   | 2048x2048 | 2304x1728 | 2560x1440   | 2496x1664 | 3024x1296 |
| 4K   | 4096x4096 | 4608x3456 | 5120x2880   | 4992x3328 | 6048x2592 |

Portrait variants are the transpose.

Provider settings: `maxSequentialImages`.

---

### Seedream 4.5

- AIR ID: `bytedance:seedream@4.5`
- Workflows: text-to-image, image-to-image
- Prompt: 1-2000 chars
- Image input: `inputs.referenceImages: string[]` — up to 14

**Input image requirements:** 14-6000px per side, aspect ratio 1:16 to 16:1, 10MB max.

**Dimension behavior:**

- Text-to-image: explicit `width` + `height` required
- Image-to-image: explicit `width` + `height`, OR `resolution` param (`"2k"` | `"4k"`) to auto-match reference aspect ratio

**Dimension constraints:** min ~3.7MP (e.g. 1920x1920), max 16.8MP (4096x4096), aspect ratio 1:16 to 16:1. Arbitrary dimensions within this range are accepted (not limited to the recommended set below). Confirmed: 1920x1920 works.

**Recommended dimensions:**

| Tier | 1:1       | 4:3 / 3:4 | 16:9 / 9:16 | 3:2 / 2:3 | 21:9      |
| ---- | --------- | --------- | ----------- | --------- | --------- |
| 2K   | 2048x2048 | 2304x1728 | 2560x1440   | 2496x1664 | 3024x1296 |
| 4K   | 4096x4096 | 4608x3456 | 5120x2880   | 4992x3328 | 6048x2592 |

Provider settings: `maxSequentialImages`, `optimizePromptMode`.

---

### Seedream 5.0 Lite

- AIR ID: `bytedance:seedream@5.0-lite`
- Workflows: text-to-image, image-to-image
- Prompt: 1-2000 chars
- Image input: `inputs.referenceImages: string[]` — up to 14
- Features: real-time search integration, reasoning, domain knowledge

**Input image requirements:** 14-6000px per side, aspect ratio 1:16 to 16:1, 10MB max.

**Resolution parameter:** `resolution` (`"2k"` | `"3k"`) — controls output quality tier.

**Supported dimensions:**

| Tier | 1:1       | 4:3 / 3:4 | 16:9 / 9:16 | 3:2 / 2:3 | 21:9      |
| ---- | --------- | --------- | ----------- | --------- | --------- |
| 2K   | 2048x2048 | 2304x1728 | 2848x1600   | 2496x1664 | 3136x1344 |
| 3K   | 3072x3072 | 3456x2592 | 4096x2304   | 3744x2496 | 4704x2016 |

Note: 2K dimensions differ from 4.0/4.5 — 16:9 is 2848x1600 (not 2560x1440), 21:9 is 3136x1344 (not 3024x1296).

Provider settings: `maxSequentialImages`, `optimizePromptMode`.
