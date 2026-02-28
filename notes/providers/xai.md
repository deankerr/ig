# xAI (via Runware)

No provider-specific settings.

---

## Image Models

### Grok Imagine Image

- AIR ID: `xai:grok-imagine@image`
- Workflows: text-to-image, image-to-image
- Prompt: 1+ chars
- Reference images: up to 1
- Image-to-image: explicit dims OR `resolution` param (`"1k"`) to auto-match reference

**Dimensions (supported — fixed set):**

| Ratio           | WxH       |
| --------------- | --------- |
| 1:1             | 1024x1024 |
| 4:3 / 3:4       | 1280x896  |
| 3:2 / 2:3       | 1296x864  |
| 16:9 / 9:16     | 1408x768  |
| 2:1 / 1:2       | 1408x704  |
| 20:9 / 9:20     | 1280x576  |
| 19.5:9 / 9:19.5 | 1248x576  |
