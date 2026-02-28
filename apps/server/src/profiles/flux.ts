import type { ModelProfile } from './types'

export const flux: ModelProfile[] = [
  // FLUX.1.1 Pro Ultra
  {
    match: { air: ['bfl:2@2'] },
    referenceImages: { path: 'referenceImages' },
    sizes: {
      landscape: [[2496, 1664]],
      portrait: [[1664, 2496]],
      square: [[2048, 2048]],
      '1:1': [[2048, 2048]],
      '4:3': [[2368, 1792]],
      '3:4': [[1792, 2368]],
      '3:2': [[2496, 1664]],
      '2:3': [[1664, 2496]],
      '16:9': [[2752, 1536]],
      '9:16': [[1536, 2752]],
      '21:9': [[3136, 1344]],
      '9:21': [[1344, 3136]],
    },
  },
  // FLUX Kontext Pro
  {
    match: { architecture: ['fluxkontextpro'] },
    referenceImages: { path: 'referenceImages' },
    sizes: {
      landscape: [[1248, 832]],
      portrait: [[832, 1248]],
      square: [[1024, 1024]],
      '1:1': [[1024, 1024]],
      '4:3': [[1184, 880]],
      '3:4': [[880, 1184]],
      '3:2': [[1248, 832]],
      '2:3': [[832, 1248]],
      '16:9': [[1392, 752]],
      '9:16': [[752, 1392]],
      '21:9': [[1568, 672]],
      '9:21': [[672, 1568]],
    },
  },
  // FLUX Kontext Max
  {
    match: { architecture: ['fluxkontextmax'] },
    referenceImages: { path: 'referenceImages' },
    sizes: {
      landscape: [[1248, 832]],
      portrait: [[832, 1248]],
      square: [[1024, 1024]],
      '1:1': [[1024, 1024]],
      '4:3': [[1184, 880]],
      '3:4': [[880, 1184]],
      '3:2': [[1248, 832]],
      '2:3': [[832, 1248]],
      '16:9': [[1392, 752]],
      '9:16': [[752, 1392]],
      '21:9': [[1568, 672]],
      '9:21': [[672, 1568]],
    },
  },
  // FLUX.1 Dev
  {
    match: { architecture: ['flux1d'] },
    range: { min: 256, max: 2048, divisor: 16 },
    sizes: {
      landscape: [[1344, 768]],
      portrait: [[768, 1344]],
      square: [[1024, 1024]],
      '1:1': [[1024, 1024]],
      '4:3': [[1344, 768]],
      '3:4': [[768, 1344]],
      '3:2': [[1344, 768]],
      '2:3': [[768, 1344]],
      '16:9': [[1344, 768]],
      '9:16': [[768, 1344]],
    },
  },
  // FLUX.2 Klein variants (nested inputs path)
  {
    match: {
      architecture: [
        'flux_2_klein_9b',
        'flux_2_klein_9b_base',
        'flux_2_klein_4b',
        'flux_2_klein_4b_base',
      ],
    },
    referenceImages: { path: 'inputs.referenceImages' },
    range: { min: 256, max: 2048, divisor: 16 },
    sizes: {
      landscape: [[1248, 832]],
      portrait: [[832, 1248]],
      square: [[1024, 1024]],
      '1:1': [[1024, 1024]],
      '4:3': [[1184, 880]],
      '3:4': [[880, 1184]],
      '3:2': [[1248, 832]],
      '2:3': [[832, 1248]],
      '16:9': [[1392, 752]],
      '9:16': [[752, 1392]],
    },
  },
  // FLUX.2 family (Pro, Max, Flex, Dev)
  {
    match: {
      architecture: ['flux_2_pro', 'flux_2_max', 'flux_2_flex', 'flux_2_dev'],
    },
    referenceImages: { path: 'referenceImages' },
    range: { min: 256, max: 2048, divisor: 16 },
    sizes: {
      landscape: [[1248, 832]],
      portrait: [[832, 1248]],
      square: [[1024, 1024]],
      '1:1': [[1024, 1024]],
      '4:3': [[1184, 880]],
      '3:4': [[880, 1184]],
      '3:2': [[1248, 832]],
      '2:3': [[832, 1248]],
      '16:9': [[1392, 752]],
      '9:16': [[752, 1392]],
    },
  },
]
