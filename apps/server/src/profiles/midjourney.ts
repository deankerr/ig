import type { DimensionProfile } from './types'

export const midjourney: DimensionProfile[] = [
  {
    match: { architecture: ['midjourney_v6', 'midjourney_v6_1', 'midjourney_v7'] },
    sizes: {
      landscape: [[1344, 896]],
      portrait: [[896, 1344]],
      square: [[1024, 1024]],
      '1:1': [[1024, 1024]],
      '4:3': [[1232, 928]],
      '3:4': [[928, 1232]],
      '3:2': [[1344, 896]],
      '2:3': [[896, 1344]],
      '16:9': [[1456, 816]],
      '9:16': [[816, 1456]],
      '21:9': [[1680, 720]],
    },
  },
]
