# OpenAI (via Runware)

Provider-specific settings path: `providerSettings.openai`

## Provider Settings

### `quality`

- Path: `providerSettings.openai.quality`
- Type: varies by model (see below)
- Required for DALL-E 3, GPT Image 1, GPT Image 1 Mini, GPT Image 1.5

### `style`

- Path: `providerSettings.openai.style`
- Type: `"vivid" | "natural"`
- Required for DALL-E 3 only

### `background`

- Path: `providerSettings.openai.background`
- Type: `"opaque" | "transparent" | "auto"`
- Required for GPT Image 1, GPT Image 1 Mini, GPT Image 1.5

---

## Image Models

### DALL-E 2

- AIR ID: `openai:2@2`
- Workflows: text-to-image
- Prompt: 1-1000 chars
- Provider settings: none

**Dimensions (supported — fixed set):**

| WxH       |
| --------- |
| 256x256   |
| 512x512   |
| 1024x1024 |

---

### DALL-E 3

- AIR ID: `openai:2@3`
- Workflows: text-to-image
- Prompt: 1-4000 chars
- Provider settings: `quality` (`"hd"` | `"standard"`, required), `style` (`"vivid"` | `"natural"`, required)

**Dimensions (supported — fixed set):**

| Ratio     | WxH       |
| --------- | --------- |
| 1:1       | 1024x1024 |
| 7:4 / 4:7 | 1792x1024 |

---

### GPT Image 1

- AIR ID: `openai:1@1`
- Workflows: text-to-image, image-to-image
- Prompt: 1-32000 chars
- Image input: `referenceImages: string[]` — up to 16
- Provider settings: `quality` (`"high"` | `"auto"`, required), `background` (required)

**Dimensions (supported — fixed set):**

| Ratio     | WxH       |
| --------- | --------- |
| 1:1       | 1024x1024 |
| 3:2 / 2:3 | 1536x1024 |

---

### GPT Image 1 Mini

- AIR ID: `openai:1@2`
- Workflows: text-to-image, image-to-image
- Prompt: 1-32000 chars
- Image input: `referenceImages: string[]` — up to 16
- ~80% cost savings vs GPT Image 1
- Provider settings: `quality` (`"high"` | `"medium"` | `"auto"`, required), `background` (`"opaque"` | `"transparent"`, required — no `"auto"`)

**Dimensions (supported — fixed set):**

| Ratio     | WxH       |
| --------- | --------- |
| 1:1       | 1024x1024 |
| 3:2 / 2:3 | 1536x1024 |

---

### GPT Image 1.5

- AIR ID: `openai:4@1`
- Workflows: text-to-image, image-to-image, image-editing
- Prompt: 2-32000 chars
- Image input: `inputs.referenceImages: string[]` — up to 16
- Best for text rendering and detailed design
- Provider settings: `quality` (`"high"` | `"auto"`, required), `background` (required)

**Dimensions (supported — fixed set):**

| Ratio     | WxH       |
| --------- | --------- |
| 1:1       | 1024x1024 |
| 3:2 / 2:3 | 1536x1024 |
