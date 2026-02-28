import type { ModelProfile } from './types'

export const other: ModelProfile[] = [
  // Z-Image / Z-Image Turbo
  {
    match: { architecture: ['z_image', 'z_image_turbo'] },
    range: { min: 512, max: 2048, divisor: 1 },
    sizes: {
      landscape: [[1344, 896]],
      portrait: [[896, 1344]],
      square: [[1024, 1024]],
      '1:1': [[1024, 1024]],
      '4:3': [[1280, 960]],
      '3:4': [[960, 1280]],
      '3:2': [[1344, 896]],
      '2:3': [[896, 1344]],
      '16:9': [[1408, 768]],
      '9:16': [[768, 1408]],
    },
  },
  // Qwen Image
  {
    match: { architecture: ['qwen_image'] },
    range: { min: 512, max: 3584, divisor: 1 },
    sizes: {
      landscape: [[1344, 896]],
      portrait: [[896, 1344]],
      square: [[1024, 1024]],
      '1:1': [[1024, 1024]],
      '4:3': [[1280, 960]],
      '3:4': [[960, 1280]],
      '3:2': [[1344, 896]],
      '2:3': [[896, 1344]],
      '16:9': [[1408, 768]],
      '9:16': [[768, 1408]],
    },
  },
]
