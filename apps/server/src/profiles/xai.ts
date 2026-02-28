import type { ModelProfile } from './types'

export const xai: ModelProfile[] = [
  {
    match: { architecture: ['grok_imagine_image'] },
    referenceImages: { path: 'referenceImages' },
    sizes: {
      landscape: [[1296, 864]],
      portrait: [[864, 1296]],
      square: [[1024, 1024]],
      '1:1': [[1024, 1024]],
      '4:3': [[1280, 896]],
      '3:4': [[896, 1280]],
      '3:2': [[1296, 864]],
      '2:3': [[864, 1296]],
      '16:9': [[1408, 768]],
      '9:16': [[768, 1408]],
      '2:1': [[1408, 704]],
      '1:2': [[704, 1408]],
      '20:9': [[1280, 576]],
      '9:20': [[576, 1280]],
    },
  },
]
