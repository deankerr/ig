import type { ModelProfile } from './types'

export const openai: ModelProfile[] = [
  // DALL-E 2
  {
    match: { air: ['openai:2@2'] },
    sizes: {
      landscape: [[1024, 1024]],
      portrait: [[1024, 1024]],
      square: [[1024, 1024]],
      '1:1': [
        [256, 256],
        [512, 512],
        [1024, 1024],
      ],
    },
  },
  // DALL-E 3
  {
    match: { air: ['openai:2@3'] },
    sizes: {
      landscape: [[1792, 1024]],
      portrait: [[1024, 1792]],
      square: [[1024, 1024]],
      '1:1': [[1024, 1024]],
      '7:4': [[1792, 1024]],
      '4:7': [[1024, 1792]],
    },
  },
  // GPT Image 1 / 1.5
  {
    match: { architecture: ['gpt_image_1', 'gpt_image_1_5'] },
    referenceImages: { path: 'referenceImages' },
    sizes: {
      landscape: [[1536, 1024]],
      portrait: [[1024, 1536]],
      square: [[1024, 1024]],
      '1:1': [[1024, 1024]],
      '3:2': [[1536, 1024]],
      '2:3': [[1024, 1536]],
    },
  },
]
