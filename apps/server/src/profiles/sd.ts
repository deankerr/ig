import type { ModelProfile } from './types'

export const sd: ModelProfile[] = [
  // SD 1.x
  {
    match: { architecture: ['sd1x', 'sd1xlcm'] },
    range: { min: 128, max: 2048, divisor: 64 },
    sizes: {
      landscape: [[768, 512]],
      portrait: [[512, 768]],
      square: [[512, 512]],
      '1:1': [[512, 512]],
      '4:3': [[640, 480]],
      '3:4': [[480, 640]],
      '3:2': [[768, 512]],
      '2:3': [[512, 768]],
    },
  },
  // SDXL
  {
    match: { architecture: ['sdxl'] },
    range: { min: 128, max: 2048, divisor: 64 },
    sizes: {
      landscape: [[1344, 768]],
      portrait: [[768, 1344]],
      square: [[1024, 1024]],
      '1:1': [[1024, 1024]],
      '9:7': [[1152, 896]],
      '7:9': [[896, 1152]],
      '4:3': [[1216, 832]],
      '3:4': [[832, 1216]],
      '7:4': [[1344, 768]],
      '4:7': [[768, 1344]],
      '12:5': [[1536, 640]],
      '5:12': [[640, 1536]],
    },
  },
  // Pony Diffusion
  {
    match: { architecture: ['pony'] },
    range: { min: 128, max: 2048, divisor: 64 },
    sizes: {
      landscape: [[1344, 768]],
      portrait: [[768, 1344]],
      square: [[1024, 1024]],
      '1:1': [[1024, 1024]],
      '9:7': [[1152, 896]],
      '7:9': [[896, 1152]],
      '4:3': [[1216, 832]],
      '3:4': [[832, 1216]],
      '7:4': [[1344, 768]],
      '4:7': [[768, 1344]],
    },
  },
]
