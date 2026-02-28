# Dimensions by Architecture

The Runware models API returns an `architecture` field per model. This is the key for mapping models → dimension behavior. The `defaultWidth`/`defaultHeight` fields are mostly 512x512 placeholders and unreliable.

## Architecture → Dimension Behavior

### Fixed dimension sets (Runware returns 400 for non-listed dims)

| Architecture                                    | Provider  | Dimension Source                                   |
| ----------------------------------------------- | --------- | -------------------------------------------------- |
| `fluxultra`                                     | BFL       | `black-forest-labs.md` — FLUX.1.1 Pro Ultra        |
| `fluxkontextpro`                                | BFL       | `black-forest-labs.md` — Kontext pro               |
| `fluxkontextmax`                                | BFL       | `black-forest-labs.md` — Kontext max (same as pro) |
| `dall_e_2`                                      | OpenAI    | `openai.md` — 256/512/1024 square only             |
| `dall_e_3`                                      | OpenAI    | `openai.md` — 1024², 1792x1024                     |
| `gpt_image_1`                                   | OpenAI    | `openai.md` — 1024², 1536x1024                     |
| `gpt_image_1_5`                                 | OpenAI    | `openai.md` — 1024², 1536x1024                     |
| `imagen3`, `imagen3fast`                        | Google    | `google.md` — Imagen 3 set                         |
| `imagen4preview`, `imagen4ultra`, `imagen4fast` | Google    | `google.md` — same as Imagen 3                     |
| `gemini_2_5_flash_image`                        | Google    | `google.md` — Nano Banana set                      |
| `gemini_3_0_pro_image`                          | Google    | `google.md` — Nano Banana 2 Pro (multi-res)        |
| `gemini_3_1_flash_image`                        | Google    | `google.md` — Nano Banana 2 (multi-res)            |
| `grok_imagine_image`                            | xAI       | `xai.md`                                           |
| `pony`                                          | Community | SDXL dims (see below)                              |

Midjourney models (`midjourney:1@1`, `midjourney:2@1`, `midjourney:3@1`) — fixed set in `midjourney.md`. Architecture field not sampled but likely `midjourney_*`.

### Arbitrary dims within pixel/range constraints

| Architecture                              | Pixel Budget   | Divisor | Sweet Spot  | Notes                                    |
| ----------------------------------------- | -------------- | ------- | ----------- | ---------------------------------------- |
| `sd1x`, `sd1xlcm`                         | ~262K          | 64      | 512x512     | See `open-source.md`                     |
| `sdxl`                                    | ~1MP           | 64      | 1024x1024   | Includes Illustrious, NoobAI derivatives |
| `flux1d`                                  | ~1MP           | 16      | 1024x1024   | FLUX.1 dev/schnell, Chroma               |
| `flux_2_pro`, `flux_2_max`, `flux_2_flex` | 256-2048px     | 16      | ~1MP        | See `black-forest-labs.md`               |
| `seedream3`                               | ?              | ?       | ?           | Untested                                 |
| `seedream4`                               | ~0.9-16.8MP    | ?       | 1024-4096   | See `bytedance.md`                       |
| `seedream_4_5`                            | ~3.7-16.8MP    | ?       | 2048-4096   | See `bytedance.md`                       |
| `seedream5`                               | fixed per tier | ?       | 2K/3K tiers | See `bytedance.md`                       |
| `z_image_turbo`, `z_image`                | 512²-2048²     | ?       | ~1MP        | See `open-source.md`                     |
| `qwen_image`                              | up to 3584²    | ?       | ~1MP        | See `open-source.md`                     |
| `twinflow_z_image_turbo`                  | ?              | ?       | ?           | Likely same as z_image_turbo             |
| `fluxpro`                                 | —              | —       | —           | Inpainting/outpainting, dims from input  |

### Unknown / untested

| Architecture                                                    | Model                            |
| --------------------------------------------------------------- | -------------------------------- |
| `hunyuanimage_3_0`                                              | HunyuanImage 3.0                 |
| `kandinsky_5_0_image_lite`                                      | Kandinsky 5.0                    |
| `qwen_image_edit`, `qwen_image_edit_plus`, `qwen_image_layered` | Editing models (dims from input) |

## Practical Defaults

For the dimensions service, the safest fallback strategy by architecture family:

- **sd1x**: 512x512 square, 512x768 portrait/landscape
- **sdxl, pony**: 1024x1024 square, 832x1216 portrait, 1216x832 landscape
- **flux1d, flux*2*\***: 1024x1024 square, 768x1344 portrait, 1344x768 landscape
- **Fixed-set models**: must map to the exact listed dimensions per model/architecture
