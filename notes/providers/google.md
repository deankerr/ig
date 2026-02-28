# Google (via Runware)

Provider-specific settings path: `providerSettings.google`

## Provider Settings

### `enhancePrompt`

- Path: `providerSettings.google.enhancePrompt`
- Type: `boolean`, default `true`
- Auto-expands prompt for better generation quality
- When enabled, reproducibility is NOT guaranteed even with same seed
- Cannot be disabled for Veo 3/3.1 (always on)

---

## Image Models

### Imagen 3.0

- AIR ID: `google:1@1`
- Workflows: text-to-image
- Prompt: 2-3000 chars

### Imagen 3.0 Fast

- AIR ID: `google:1@2`
- Workflows: text-to-image
- Prompt: 2-3000 chars
- Negative prompt: 2-3000 chars (optional)

### Imagen 4.0 Preview

- AIR ID: `google:2@1`
- Workflows: text-to-image
- Prompt: 2-3000 chars

### Imagen 4.0 Ultra

- AIR ID: `google:2@2`
- Workflows: text-to-image
- Prompt: 2-3000 chars

### Imagen 4.0 Fast

- AIR ID: `google:2@3`
- Workflows: text-to-image
- Prompt: 2-3000 chars
- Negative prompt: 2-3000 chars (optional)

**Dimensions (supported — fixed set, shared across all Imagen models):**

| Ratio       | WxH                 |
| ----------- | ------------------- |
| 1:1         | 1024x1024           |
| 4:3 / 3:4   | 1280x896            |
| 3:2 / 2:3   | 1408x768 (Imagen 3) |
| 16:9 / 9:16 | 1408x768            |

---

### Nano Banana (Gemini Flash Image 2.5)

- AIR ID: `google:4@1`
- Workflows: text-to-image, image-to-image
- Prompt: 2-3000 chars
- Image input: `referenceImages: string[]` — up to 8
- Watermarking: invisible SynthID on all outputs
- Image-to-image: output dimensions auto-match reference aspect ratio (width/height ignored)

**Dimensions (supported — fixed set):**

| Ratio       | WxH       |
| ----------- | --------- |
| 1:1         | 1024x1024 |
| 3:2 / 2:3   | 1248x832  |
| 4:3 / 3:4   | 1184x864  |
| 5:4 / 4:5   | 1152x896  |
| 16:9 / 9:16 | 1344x768  |
| 21:9        | 1536x672  |

---

### Nano Banana 2 Pro (Gemini 3 Pro Image)

- AIR ID: `google:4@2`
- Workflows: text-to-image, image-to-image
- Prompt: 3-45000 chars
- Image input: `referenceImages: string[]` — up to 14
- Watermarking: invisible SynthID
- Input image: 300-2048px per side, 20MB max
- Image-to-image: explicit dims OR `resolution` param (`"1k"` | `"2k"` | `"4k"`) to auto-match reference

**Dimensions (supported — fixed set, multi-resolution):**

| Ratio       | 1K        | 2K        | 4K        |
| ----------- | --------- | --------- | --------- |
| 1:1         | 1024x1024 | 2048x2048 | 4096x4096 |
| 3:2 / 2:3   | 1264x848  | 2528x1696 | 5056x3392 |
| 4:3 / 3:4   | 1200x896  | 2400x1792 | 4800x3584 |
| 5:4 / 4:5   | 1152x928  | 2304x1856 | 4608x3712 |
| 16:9 / 9:16 | 1376x768  | 2752x1536 | 5504x3072 |
| 21:9        | 1548x672  | 3168x1344 | 6336x2688 |

---

### Nano Banana 2 (Gemini 3.1 Flash Image)

- AIR ID: `google:4@3`
- Workflows: text-to-image, image-to-image
- Prompt: 3-45000 chars
- Image input: `referenceImages: string[]` — up to 14
- Watermarking: invisible SynthID
- Input image: 300-2048px per side, 20MB max
- Image-to-image: explicit dims OR `resolution` param (`"0.5k"` | `"1k"` | `"2k"` | `"4k"`)

**Dimensions (supported — fixed set, multi-resolution):**

Same ratios as Nano Banana 2 Pro, plus additional ratios:

| Ratio       | 0.5K     | 1K        | 2K        | 4K         |
| ----------- | -------- | --------- | --------- | ---------- |
| 1:1         | 512x512  | 1024x1024 | 2048x2048 | 4096x4096  |
| 3:2 / 2:3   | 632x424  | 1264x848  | 2528x1696 | 5056x3392  |
| 4:3 / 3:4   | 600x448  | 1200x896  | 2400x1792 | 4800x3584  |
| 5:4 / 4:5   | 576x464  | 928x1152  | 1856x2304 | 3712x4608  |
| 16:9 / 9:16 | 688x384  | 1376x768  | 2752x1536 | 5504x3072  |
| 21:9        | 792x168  | 1584x672  | 3168x1344 | 6336x2688  |
| 4:1 / 1:4   | 1024x256 | 2048x512  | 4096x1024 | 8192x2048  |
| 8:1 / 1:8   | 1536x192 | 3072x384  | 6144x768  | 12288x1536 |
