# Open Source / Community Models (via Runware)

Covers SD1.5, SDXL, FLUX, and other open-weight architectures available through CivitAI and Runware AIR IDs.

## Shared Constraints

- All dimensions must be **divisible by 64** (SD1.5/SDXL) or **divisible by 16** (FLUX-based)
- Dimension range: 128-2048px per side (Runware constraint)
- Steps: 1-100
- CFGScale: 0-30

---

## SD1.5

Base training resolution: **512x512** (~262K pixels).

Works best near ~262K total pixels. Going significantly beyond causes composition breakdown (repeated subjects, incoherent layouts).

**Recommended dimensions:**

| Ratio     | WxH     |
| --------- | ------- |
| 1:1       | 512x512 |
| 3:4 / 4:3 | 512x768 |
| 2:3 / 3:2 | 512x768 |

Some fine-tuned models (e.g. DreamShaper) can push to 768x768 or 640x896 but results vary by checkpoint.

**Test models:** `civitai:4384@128713` (DreamShaper)

---

## SDXL

Base training resolution: **1024x1024** (~1MP).

Fine-tuned on multiple aspect ratios at ~1MP total pixels. Best results stay near this pixel budget.

**Recommended dimensions (from SDXL training set):**

| Ratio         | WxH       |
| ------------- | --------- |
| 1:1           | 1024x1024 |
| 9:7 / 7:9     | 1152x896  |
| 19:13 / 13:19 | 1216x832  |
| 7:4 / 4:7     | 1344x768  |
| 12:5 / 5:12   | 1536x640  |

Juggernaut XL XI (`civitai:133005@782002`) was trained at **832x1216** (portrait) — use this or the 1216x832 landscape equivalent for best results.

**Test models:** `rundiffusion:120964@131579` (RunDiffusionXL)

---

## SDXL Derivatives

These are based on the SDXL architecture but finetuned on large, distinct datasets. Use SDXL dimensions — they share the ~1MP pixel budget and div-by-64 constraint.

### Illustrious XL

- SDXL-based, anime/illustration focused
- Native resolution pushed to **1536x1536** (v1.0+), a first for the SDXL architecture
- Supports 512-1536px range including non-standard sizes like 1248x1824
- SDXL dims work fine; higher resolutions are a bonus, not a requirement
- Danbooru tag + natural language prompting

### NoobAI XL

- Fine-tuned from Illustrious XL (early release)
- Trained on full Danbooru + e621 datasets (~13M images)
- Recommended: **832x1216** (portrait), standard SDXL dims at ~1MP
- Two versions: noise prediction (more creative) and V-prediction (more prompt-adherent)

### Pony Diffusion V6 XL

- SDXL fine-tune, anime/anthro/humanoid focused
- Uses SDXL dimensions at ~1MP
- Requires **clip skip 2** or results degrade to "low quality blobs"
- Uses score-based quality tags: `score_9, score_8_up, score_7_up, ...`
- 870K+ downloads on CivitAI — one of the most popular community models

---

## FLUX.1 (Open Source)

Architecture: Flow transformer, 12B params. Arbitrary dims, multiples of 16.

### FLUX.1 [dev]

- Open-weight, non-commercial license
- Training resolution: ~1MP, supports arbitrary aspect ratios
- Dimensions: 256-2048px (multiples of 16), best at ~1MP
- Steps: typically 20-50
- The foundation many community LoRAs target

### FLUX.1 [schnell]

- Distilled version of FLUX.1 dev, Apache 2.0 licensed
- 1-4 step generation
- Same dimension handling as dev

Both are available on Runware via CivitAI AIR IDs. The newer FLUX.2 family (documented in black-forest-labs.md) supersedes these with `runware:400@*` IDs.

---

## FLUX Derivatives

Based on the FLUX.1 architecture. Use FLUX dimensions — arbitrary, multiples of 16, ~1MP sweet spot.

### Chroma

- 8.9B params, based on FLUX.1 schnell
- **Apache 2.0** licensed (fully open, unlike FLUX.1 dev)
- Designed as a finetuning base — intentionally neutral
- Variants: Base, HD (high-res finetune), Flash (CFG baked)
- Same dimension handling as FLUX.1

### Z-Image Turbo

- 6B params, Alibaba (Tongyi-MAI), custom S3-DiT architecture
- Distilled for speed: 8 steps, sub-second inference
- Dimensions: total pixels between 512x512 and 2048x2048, arbitrary within range
- Strong at photorealism and bilingual text rendering (EN/CN)

### Qwen Image

- 20B params, Alibaba (Qwen team), MMDiT architecture
- Native resolution up to **3584x3584** without upscaling
- Exceptional text rendering accuracy (EN + CN)
- Also does image editing via reference images
- Qwen Image 2.0 (Feb 2026): unified model, reduced to 7B params

---

## Dimension Behavior

All models in this file accept **arbitrary dimensions** within their range constraints. The recommended sets are "sweet spots" from training — not enforced by Runware like Midjourney/Kontext/OpenAI fixed sets are. Non-standard dims will generate but may produce artifacts, composition issues, or reduced quality the further you stray from the training budget.
