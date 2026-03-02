```ts
export enum ETaskType {
  IMAGE_INFERENCE = 'imageInference',
  IMAGE_UPLOAD = 'imageUpload',
  UPSCALE = 'upscale',
  REMOVE_BACKGROUND = 'removeBackground',
  VIDEO_INFERENCE = 'videoInference',
  CAPTION = 'caption',
  AUDIO_INFERENCE = 'audioInference',
  GET_RESPONSE = 'getResponse',
  PHOTO_MAKER = 'photoMaker',
  IMAGE_CONTROL_NET_PRE_PROCESS = 'imageControlNetPreProcess',
  IMAGE_MASKING = 'imageMasking',
  PROMPT_ENHANCE = 'promptEnhance',
  AUTHENTICATION = 'authentication',
  MODEL_UPLOAD = 'modelUpload',
  MODEL_SEARCH = 'modelSearch',
  MEDIA_STORAGE = 'mediaStorage',
  VECTORIZE = 'vectorize',
}

export type IOutputType = 'base64Data' | 'dataURI' | 'URL'
export type IOutputFormat = 'JPG' | 'PNG' | 'WEBP'
export type IVideoOutputFormat = 'MP4' | 'WEBM' | 'MOV'
export type IAudioOutputFormat = 'MP3'

export interface IImage {
  taskType: ETaskType
  imageUUID?: string
  inputImageUUID?: string
  taskUUID: string
  status: string
  imageURL?: string
  imageBase64Data?: string
  imageDataURI?: string
  NSFWContent?: boolean
  cost?: number
  seed: number
  mediaUUID?: string
  mediaURL?: string
}

export interface ITextToImage extends IImage {
  positivePrompt?: string
  negativePrompt?: string
}

export interface IVideoToImage {
  taskUUID: string
  taskType: string
  status: string
  videoUUID?: string
  cost?: number
  seed?: number
  videoURL?: string
}

export interface IControlNetImage {
  taskUUID: string
  inputImageUUID: string
  guideImageUUID: string
  guideImageURL?: string
  guideImageBase64Data?: string
  guideImageDataURI?: string
  cost?: number
}

interface ILora {
  model: string | number
  weight: number
}

export enum EControlMode {
  BALANCED = 'balanced',
  PROMPT = 'prompt',
  CONTROL_NET = 'controlnet',
}

export type IControlNetGeneral = {
  model: string
  guideImage: string | File
  weight?: number
  startStep?: number
  startStepPercentage?: number
  endStep?: number
  endStepPercentage?: number
  controlMode: EControlMode
}
export type IControlNetPreprocess = {
  inputImage: string | File
  preProcessorType: EPreProcessorGroup
  height?: number
  width?: number
  outputType?: IOutputType
  outputFormat?: IOutputFormat
  highThresholdCanny?: number
  lowThresholdCanny?: number
  includeHandsAndFaceOpenPose?: boolean
  includeCost?: boolean
  outputQuality?: number

  customTaskUUID?: string
  taskUUID?: string
  retry?: number
} & IAdditionalResponsePayload

export type IControlNet = IControlNetGeneral

export type IControlNetWithUUID = Omit<IControlNet, 'guideImage'> & {
  guideImage?: string
}

export interface IError {
  error: boolean
  errorMessage: string
  taskUUID: string
}

export type TPromptWeighting = 'compel' | 'sdEmbeds'

export interface IRequestImage extends IAdditionalResponsePayload {
  outputType?: IOutputType
  outputFormat?: IOutputFormat
  uploadEndpoint?: string
  checkNSFW?: boolean
  positivePrompt: string
  negativePrompt?: string
  seedImage?: File | string
  maskImage?: File | string
  strength?: number
  height?: number
  width?: number
  model: number | string
  steps?: number
  scheduler?: string
  seed?: number
  maskMargin?: number
  CFGScale?: number
  clipSkip?: number
  /**
   * @deprecated The usePromptWeighting should not be used, use promptWeighting instead
   */
  usePromptWeighting?: boolean
  promptWeighting?: TPromptWeighting
  numberResults?: number // default to 1
  includeCost?: boolean
  outputQuality?: number

  controlNet?: IControlNet[]
  lora?: ILora[]
  embeddings?: IEmbedding[]
  ipAdapters?: IipAdapter[]
  providerSettings?: IProviderSettings
  outpaint?: IOutpaint
  refiner?: IRefiner
  acceleratorOptions?: TAcceleratorOptions
  advancedFeatures?: {
    layerDiffuse: boolean
  }
  referenceImages?: string[]

  // imageSize?: number;
  customTaskUUID?: string
  onPartialImages?: (images: IImage[], error?: IError) => void
  retry?: number
  // gScale?: number;

  [key: string]: any
}

export type TAcceleratorOptions =
  | { teaCache: boolean; teaCacheDistance: number }
  | {
      deepCache: boolean
      deepCacheInterval: number
      deepCacheBranchId: number
    }

export interface IOutpaint {
  top?: number
  bottom?: number
  right?: number
  left?: number
  blur?: number
}
export interface IEmbedding {
  model: string
  weight: number
}
export interface IipAdapter {
  model: string
  weight: number
  guideImage: string
}

export interface IBflProviderSettings {
  promptUpsampling?: boolean
  safetyTolerance?: number
  raw?: boolean
}

export type ProviderSettings = {
  bfl: IBflProviderSettings
}

export type IProviderSettings = RequireOnlyOne<ProviderSettings, keyof ProviderSettings>

export interface IRefiner {
  model: string
  startStep?: number
  startStepPercentage?: number
}
export interface IRequestImageToText extends IAdditionalResponsePayload {
  model?: string
  inputImage?: File | string
  inputs?: {
    video?: InputsValue
  } & {
    [key: string]: unknown
  }
  includeCost?: boolean
  customTaskUUID?: string
  taskUUID?: string
  retry?: number

  deliveryMethod?: string
  skipResponse?: boolean
}
export interface IImageToText {
  taskType: ETaskType
  taskUUID: string
  status: string
  text: string
  cost?: number
}

export interface IRemoveImageBackground extends IRequestImageToText {
  outputType?: IOutputType
  outputFormat?: IOutputFormat | 'MP4' | 'WEBM' | 'MOV'
  model: string
  inputs?: {
    video?: InputsValue
    image?: InputsValue
  }
  settings?: {
    rgba?: number[]
    postProcessMask?: boolean
    returnOnlyMask?: boolean
    alphaMatting?: boolean
    alphaMattingForegroundThreshold?: number
    alphaMattingBackgroundThreshold?: number
    alphaMattingErodeSize?: number
  }
  includeCost?: boolean
  outputQuality?: number
  retry?: number

  skipResponse?: boolean
  deliveryMethod?: string
}

type InputsValue = string | Record<string, unknown>

export interface IRequestVideo extends IRequestImageToText {
  outputType?: IOutputType
  outputFormat?: IVideoOutputFormat
  outputQuality?: number
  uploadEndpoint?: string
  checkNSFW?: boolean
  includeCost?: boolean
  positivePrompt?: string
  negativePrompt?: string
  model: string
  steps?: number
  CFGScale?: number
  seed?: number
  duration?: number
  fps?: number
  width?: number
  height?: number
  numberResults?: number
  inputAudios?: string[]
  referenceVideos?: string[]
  inputs?: {
    image?: InputsValue
    images?: InputsValue[]
    audio?: InputsValue
    audios?: InputsValue[]
    mask?: InputsValue[]
    reference?: InputsValue
    references?: InputsValue[]
  } & {
    [key: string]: unknown
  }
  speech?: {
    voice: string
    text: string
  }
  skipResponse?: boolean
  customTaskUUID?: string
  retry?: number

  [key: string]: any
}

export interface IAudio {
  taskUUID: string
  taskType: string
  status: string
  audioUUID?: string
  audioURL?: string
  audioBase64Data?: string
  audioDataURI?: string
  cost?: number
}

export interface IRequestAudio {
  model: string
  numberResults?: number
  outputType?: IOutputType
  outputFormat?: IAudioOutputFormat
  uploadEndpoint?: string
  includeCost?: boolean
  positivePrompt?: string
  duration?: number
  audioSettings?: {
    sampleRate?: number
    bitrate?: number
  } & {
    [key: string]: unknown
  }
  inputs?: {
    video?: InputsValue
  } & {
    [key: string]: unknown
  }
  deliveryMethod?: string

  taskUUID?: string
  customTaskUUID?: string

  skipResponse?: boolean
  retry?: number

  [key: string]: unknown
}

export interface IAsyncResults {
  taskUUID: string
  onPartialImages?: (images: IImage[], error?: IError) => void
}

export interface IRemoveImage {
  taskType: ETaskType
  taskUUID: string
  status: string
  imageUUID?: string
  mediaUUID?: string
  mediaURL?: string
  videoUUID?: string
  inputImageUUID: string
  imageURL?: string
  imageBase64Data?: string
  imageDataURI?: string
  cost?: number
}

export interface IPromptEnhancer extends IAdditionalResponsePayload {
  promptMaxLength?: number
  promptVersions?: number
  prompt: string
  includeCost?: boolean
  customTaskUUID?: string
  taskUUID?: string
  retry?: number
}

export interface IEnhancedPrompt extends IImageToText {}

export interface IUpscaleGan extends IAdditionalResponsePayload {
  inputImage?: File | string
  upscaleFactor: number
  outputType?: IOutputType
  outputFormat?: IOutputFormat | 'MP4' | 'WEBM' | 'MOV'
  includeCost?: boolean
  outputQuality?: number

  inputs?: {
    video?: InputsValue
    image?: InputsValue
  } & {
    [key: string]: unknown
  }
  model?: string

  customTaskUUID?: string
  taskUUID?: string
  retry?: number

  skipResponse?: boolean
  deliveryMethod?: string
}

export interface IErrorResponse {
  code: string
  message: string
  parameter: string
  type: string
  documentation: string
  taskUUID: string
  min?: number
  max?: number
  default?: string | number
}

export enum EModelArchitecture {
  flux1d = 'flux1d',
  flux1s = 'flux1s',
  pony = 'pony',
  sdhyper = 'sdhyper',
  sd1x = 'sd1x',
  sd1xlcm = 'sd1xlcm',
  sd3 = 'sd3',
  sdxl = 'sdxl',
  sdxllcm = 'sdxllcm',
  sdxldistilled = 'sdxldistilled',
  sdxlhyper = 'sdxlhyper',
  sdxllightning = 'sdxllightning',
  sdxlturbo = 'sdxlturbo',
}

export type TModelSearch = {
  search?: string
  tags?: string[]
  category?: 'checkpoint' | 'lora' | 'controlnet'
  type?: string
  architecture?: EModelArchitecture
  conditioning?: string
  visibility?: 'public' | 'private' | 'all'
  limit?: number
  offset?: number

  // other options
  customTaskUUID?: string
  retry?: number
} & { [key: string]: any }

export type TModel = {
  air: string
  name: string
  version: string
  category: string
  architecture: string
  tags: string[]
  heroImage: string
  private: boolean
  comment: string

  // Optionals
  type?: string
  defaultWidth?: number
  defaultHeight?: number
  defaultSteps?: number
  defaultScheduler?: string
  defaultCFG?: number
  defaultStrength: number
  conditioning?: string
  positiveTriggerWords?: string
} & { [key: string]: any }

export type TModelSearchResponse = {
  results: TModel[]
  taskUUID: string
  taskType: string
  totalResults: number
}

export type TServerError = {
  error: {
    code: string
    message: string
    parameter: string
    type: string
    taskType: string
  }
}

export type MediaUUID = {
  mediaUUID?: string
  audioUUID?: string
  imageUUID?: string
  videoUUID?: string
}
```
