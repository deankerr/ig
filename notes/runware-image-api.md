---
title: Image Inference API | Runware Docs
url: https://runware.ai/docs/image-inference/api-reference
description: Generate images from text prompts or transform existing ones using Runware's API. Learn how to do image inference for creative and high-quality results.
relatedDocs:
  - https://runware.ai/docs/image-inference/introduction
  - https://runware.ai/docs/image-inference/models
  - https://runware.ai/docs/utilities/image-upload
---

## [Introduction](#introduction)

Image inference is a powerful feature that allows you to **generate images from text prompts** or **transform existing images** according to your needs. This page is the complete API reference for image inference tasks. All workflows and operations use the single `imageInference` task type, differentiated through parameter combinations.

### [Core operations](#core-operations)

- **Text-to-image**: Generate images from text descriptions ([full guide](https://runware.ai/docs/image-inference/text-to-image)).
- **Image-to-image**: Transform existing images based on prompts ([full guide](https://runware.ai/docs/image-inference/image-to-image)).
- **Inpainting**: Edit specific areas within images ([full guide](https://runware.ai/docs/image-inference/inpainting)).
- **Outpainting**: Extend images beyond original boundaries ([full guide](https://runware.ai/docs/image-inference/outpainting)).

### [Advanced features](#advanced-features)

Additional parameters enable specialized capabilities:

- **Style and control**: ControlNet, LoRA, IP-Adapters, Embeddings.
- **Quality enhancement**: Refiners, VAE.
- **Identity**: PuLID, ACE++, PhotoMaker.
- **Performance and other**: Accelerator options, Advanced features.

Each feature includes detailed parameter documentation below.

## [Request](#request)

Our API always accepts an array of objects as input, where each object represents a **specific task to be performed**. The structure varies depending on the workflow and features used.

The following examples demonstrate how different parameter combinations create specific workflows.

**Text to Image**:

```json
{
  "taskType": "imageInference",
  "taskUUID": "a770f077-f413-47de-9dac-be0b26a35da6",
  "outputType": "URL",
  "outputFormat": "jpg",
  "positivePrompt": "a serene mountain landscape with a crystal-clear lake reflecting the sky",
  "height": 1024,
  "width": 1024,
  "model": "runware:101@1",
  "steps": 30,
  "CFGScale": 7.5,
  "numberResults": 4
}
```

**Image to Image**:

```json
{
  "taskType": "imageInference",
  "taskUUID": "b8c4d952-7f27-4a6e-bc9a-83f01d1c6d59",
  "positivePrompt": "a watercolor painting style, soft brushstrokes, artistic interpretation",
  "seedImage": "c64351d5-4c59-42f7-95e1-eace013eddab",
  "model": "civitai:139562@297320",
  "height": 1024,
  "width": 1024,
  "strength": 0.7,
  "numberResults": 1
}
```

**Inpainting**:

```json
{
  "taskType": "imageInference",
  "taskUUID": "f3a2b8c9-1e47-4d3a-9b2f-8c7e6d5a4b3c",
  "positivePrompt": "a red leather sofa, modern furniture, well-lit room",
  "seedImage": "c64351d5-4c59-42f7-95e1-eace013eddab",
  "maskImage": "d7e8f9a0-2b5c-4e7f-a1d3-9c8b7a6e5d4f",
  "model": "civitai:139562@297320",
  "height": 1024,
  "width": 1024,
  "strength": 0.8,
  "numberResults": 1
}
```

**Outpainting**:

```json
{
  "taskType": "imageInference",
  "taskUUID": "e4d3c2b1-5a6f-4c8e-b2d7-1f0e9d8c7b6a",
  "positivePrompt": "forest",
  "seedImage": "c64351d5-4c59-42f7-95e1-eace013eddab",
  "outpaint": {
    "top": 128,
    "bottom": 128,
    "left": 64,
    "right": 64
  },
  "model": "civitai:139562@297320",
  "height": 1024,
  "width": 1152,
  "numberResults": 1
}
```

**Refiner**:

```json
{
  "taskType": "imageInference",
  "taskUUID": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "positivePrompt": "a highly detailed portrait of a wise old wizard with a long beard",
  "model": "civitai:139562@297320",
  "refiner": {
    "model": "civitai:101055@128080",
    "startStep": 30
  },
  "height": 1024,
  "width": 1024,
  "steps": 35,
  "CFGScale": 8.0,
  "numberResults": 1
}
```

**Embeddings**:

```json
{
  "taskType": "imageInference",
  "taskUUID": "9876543210-abcd-ef12-3456-789012345678",
  "positivePrompt": "a fantasy castle in the MyStyle aesthetic, dramatic lighting, epiCPhoto",
  "model": "civitai:25694@143906",
  "height": 512,
  "width": 512,
  "embeddings": [
    {
      "model": "civitai:195911@220262",
      "weight": 0.8
    }
  ],
  "numberResults": 1
}
```

**ControlNet**:

```json
{
  "taskType": "imageInference",
  "taskUUID": "12345678-9abc-def0-1234-56789abcdef0",
  "positivePrompt": "a photorealistic portrait of a young woman, professional lighting",
  "model": "runware:101@1",
  "height": 1024,
  "width": 1024,
  "controlNet": [
    {
      "model": "runware:25@1",
      "guideImage": "9d7271cb-1be3-4607-88af-d039d771e5aa",
      "weight": 0.8,
      "startStep": 0,
      "endStep": 10,
      "controlMode": "balanced"
    }
  ],
  "numberResults": 1
}
```

**LoRA**:

```json
{
  "taskType": "imageInference",
  "taskUUID": "fedcba09-8765-4321-0fed-cba987654321",
  "positivePrompt": "a steampunk airship flying through cloudy skies, Victorian aesthetic",
  "model": "runware:101@1",
  "height": 1024,
  "width": 1024,
  "lora": [
    {
      "model": "civitai:652699@993999",
      "weight": 0.95
    }
  ],
  "numberResults": 1
}
```

**IPAdapters**:

```json
{
  "taskType": "imageInference",
  "taskUUID": "abcdef12-3456-7890-abcd-ef1234567890",
  "positivePrompt": "__BLANK__",
  "model": "runware:101@1",
  "height": 1024,
  "width": 1024,
  "ipAdapters": [
    {
      "model": "runware:105@1",
      "guideImage": "6963a97e-f017-408b-a447-6345ec31a4f0"
    }
  ],
  "numberResults": 1
}
```

---

### [taskType](https://runware.ai/docs/image-inference/api-reference#request-tasktype)

- **Type**: `string`
- **Required**: true

The type of task to be performed. For this task, the value should be `imageInference`.

### [taskUUID](https://runware.ai/docs/image-inference/api-reference#request-taskuuid)

- **Type**: `string (UUID v4)`
- **Required**: true

When a task is sent to the API you must include a random UUID v4 string using the `taskUUID` parameter. This string is used to match the async responses to their corresponding tasks.

If you send multiple tasks at the same time, the `taskUUID` will help you match the responses to the correct tasks.

The `taskUUID` must be unique for each task you send to the API.

### [outputType](https://runware.ai/docs/image-inference/api-reference#request-outputtype)

- **Type**: `"base64Data" | "dataURI" | "URL"`
- **Default**: URL

Specifies the output type in which the image is returned. Supported values are: `dataURI`, `URL`, and `base64Data`.

- `base64Data`: The image is returned as a base64-encoded string using the `imageBase64Data` parameter in the response object.
- `dataURI`: The image is returned as a data URI string using the `imageDataURI` parameter in the response object.
- `URL`: The image is returned as a URL string using the `imageURL` parameter in the response object.

### [outputFormat](https://runware.ai/docs/image-inference/api-reference#request-outputformat)

- **Type**: `"JPG" | "PNG" | "WEBP"`
- **Default**: JPG

Specifies the format of the output image. Supported formats are: `PNG`, `JPG` and `WEBP`.

### [outputQuality](https://runware.ai/docs/image-inference/api-reference#request-outputquality)

- **Type**: `integer`
- **Min**: 20
- **Max**: 99
- **Default**: 95

Sets the compression quality of the output image. Higher values preserve more quality but increase file size, lower values reduce file size but decrease quality.

### [webhookURL](https://runware.ai/docs/image-inference/api-reference#request-webhookurl)

- **Type**: `string`

Specifies a webhook URL where JSON responses will be sent via HTTP POST when generation tasks complete. For batch requests with multiple results, each completed item triggers a separate webhook call as it becomes available.

Webhooks can be secured using standard authentication methods supported by your endpoint, such as tokens in query parameters or API keys.

```text
// Basic webhook endpoint
https://api.example.com/webhooks/runware

// With authentication token in query
https://api.example.com/webhooks/runware?token=your_auth_token

// With API key parameter
https://api.example.com/webhooks/runware?apiKey=sk_live_abc123

// With custom tracking parameters
https://api.example.com/webhooks/runware?projectId=proj_789&userId=12345
```

The webhook POST body contains the JSON response for the completed task according to your request configuration.

### [deliveryMethod](https://runware.ai/docs/image-inference/api-reference#request-deliverymethod)

- **Type**: `"sync" | "async"`
- **Required**: true
- **Default**: sync

Determines how the API delivers task results. Choose between immediate synchronous delivery or polling-based asynchronous delivery depending on your task requirements.

**Sync mode (`"sync"`)**:

Returns complete results directly in the API response when processing completes within the timeout window. For long-running tasks like video generation or model uploads, the request will timeout before completion, though the task continues processing in the background and results remain accessible through the dashboard.

**Async mode (`"async"`)**:

Returns an immediate acknowledgment with the task UUID, requiring you to poll for results using [getResponse](https://runware.ai/docs/utilities/task-responses) once processing completes. This approach prevents timeout issues and allows your application to handle other operations while waiting.

**Polling workflow (async)**:

1. Submit request with `deliveryMethod: "async"`.
2. Receive immediate response with the task UUID.
3. Poll for completion using `getResponse` task.
4. Retrieve final results when status shows `"success"`.

**When to use each mode**:

- **Sync**: Fast image generation, simple processing tasks.
- **Async**: Video generation, model uploads, or any task that usually takes more than 60 seconds.

Async mode is required for computationally intensive operations to avoid timeout errors.

### [uploadEndpoint](https://runware.ai/docs/image-inference/api-reference#request-uploadendpoint)

- **Type**: `string`

Specifies a URL where the generated content will be automatically uploaded using the HTTP PUT method. The raw binary data of the media file is sent directly as the request body. For secure uploads to cloud storage, use presigned URLs that include temporary authentication credentials.

**Common use cases:**

- **Cloud storage**: Upload directly to S3 buckets, Google Cloud Storage, or Azure Blob Storage using presigned URLs.
- **CDN integration**: Upload to content delivery networks for immediate distribution.

```text
// S3 presigned URL for secure upload
https://your-bucket.s3.amazonaws.com/generated/content.mp4?X-Amz-Signature=abc123&X-Amz-Expires=3600

// Google Cloud Storage presigned URL
https://storage.googleapis.com/your-bucket/content.jpg?X-Goog-Signature=xyz789

// Custom storage endpoint
https://storage.example.com/uploads/generated-image.jpg
```

The content data will be sent as the request body to the specified URL when generation is complete.

### [safety](https://runware.ai/docs/image-inference/api-reference#request-safety)

- **Path**: `safety.checkContent`
- **Type**: `object (1 property)`

Configuration object for content safety checking to detect and filter inappropriate content in generated media.

**Example**:

```json
{
  "taskType": "imageInference",
  "taskUUID": "a770f077-f413-47de-9dac-be0b26a35da6",
  "model": "runware:101@1",
  "positivePrompt": "A person walking in a park",
  "width": 1024,
  "height": 1024,
  "safety": {
    "checkContent": true
  }
}
```

#### [checkContent](https://runware.ai/docs/image-inference/api-reference#request-safety-checkcontent)

- **Path**: `safety.checkContent`
- **Type**: `boolean`
- **Default**: false

Simple toggle for enabling content safety checking. When enabled, defaults to `fast` mode for optimal performance while maintaining content safety.

This provides an easy way to enable safety checking without needing to specify detailed mode configurations.

### [ttl](https://runware.ai/docs/audio-inference/api-reference#request-ttl)

- **Type**: `integer`
- **Min**: 60

Specifies the time-to-live (TTL) in seconds for generated content when using URL output. This determines how long the generated content will be available at the provided URL before being automatically deleted.

This parameter only takes effect when `outputType` is set to `"URL"`. It has no effect on other output types.

### [includeCost](https://runware.ai/docs/image-inference/api-reference#request-includecost)

- **Type**: `boolean`
- **Default**: false

If set to `true`, the cost to perform the task will be included in the response object.

### [positivePrompt](https://runware.ai/docs/image-inference/api-reference#request-positiveprompt)

- **Type**: `string`
- **Required**: true

A positive prompt is a text instruction to guide the model on generating the image. It is usually a sentence or a paragraph that provides positive guidance for the task. This parameter is essential to shape the desired results.

For example, if the positive prompt is "dragon drinking coffee", the model will generate an image of a dragon drinking coffee. The more detailed the prompt, the more accurate the results.

If you wish to generate an image without any prompt guidance, you can use the special token `__BLANK__`. This tells the system to generate an image without text-based instructions.

The length of the prompt must be between 2 and 3000 characters.

**Learn more** (2 resources):

- [Text to image: Turning words into pictures with AI](https://runware.ai/docs/image-inference/text-to-image#prompts-guiding-the-generation) (guide)
- [Outpainting: Expanding image boundaries](https://runware.ai/docs/image-inference/outpainting#other-critical-parameters) (guide)

### [negativePrompt](https://runware.ai/docs/image-inference/api-reference#request-negativeprompt)

- **Type**: `string`

A negative prompt is a text instruction to guide the model on generating the image. It is usually a sentence or a paragraph that provides negative guidance for the task. This parameter helps to avoid certain undesired results.

For example, if the negative prompt is "red dragon, cup", the model will follow the positive prompt but will avoid generating an image of a red dragon or including a cup. The more detailed the prompt, the more accurate the results.

The length of the prompt must be between 2 and 3000 characters.

**Learn more** (1 resource):

- [Text to image: Turning words into pictures with AI](https://runware.ai/docs/image-inference/text-to-image#prompts-guiding-the-generation) (guide)

### [seedImage](https://runware.ai/docs/image-inference/api-reference#request-seedimage)

- **Type**: `string`
- **Required**: true

When doing image-to-image, inpainting or outpainting, this parameter is required.

Specifies the seed image to be used for the diffusion process. The image can be specified in one of the following formats:

- An UUID v4 string of a [previously uploaded image](https://runware.ai/docs/utilities/image-upload) or a [generated image](https://runware.ai/docs/image-inference/api-reference).
- A data URI string representing the image. The data URI must be in the format `data:<mediaType>;base64,` followed by the base64-encoded image. For example: `data:image/png;base64,iVBORw0KGgo...`.
- A base64 encoded image without the data URI prefix. For example: `iVBORw0KGgo...`.
- A URL pointing to the image. The image must be accessible publicly.

Supported formats are: PNG, JPG and WEBP.

**Learn more** (3 resources):

- [Image-to-image: The art of AI-powered image transformation](https://runware.ai/docs/image-inference/image-to-image#seed-image-the-foundation) (guide)
- [Inpainting: Selective image editing](https://runware.ai/docs/image-inference/inpainting#seed-and-mask-image-the-foundation) (guide)
- [Outpainting: Expanding image boundaries](https://runware.ai/docs/image-inference/outpainting#seed-image-the-starting-point) (guide)

### [maskImage](https://runware.ai/docs/image-inference/api-reference#request-maskimage)

- **Type**: `string`
- **Required**: true

When doing inpainting, this parameter is required.

Specifies the mask image to be used for the inpainting process. The image can be specified in one of the following formats:

- An UUID v4 string of a [previously uploaded image](https://runware.ai/docs/utilities/image-upload) or a [generated image](https://runware.ai/docs/image-inference/api-reference).
- A data URI string representing the image. The data URI must be in the format `data:<mediaType>;base64,` followed by the base64-encoded image. For example: `data:image/png;base64,iVBORw0KGgo...`.
- A base64 encoded image without the data URI prefix. For example: `iVBORw0KGgo...`.
- A URL pointing to the image. The image must be accessible publicly.

Supported formats are: PNG, JPG and WEBP.

**Learn more** (1 resource):

- [Inpainting: Selective image editing](https://runware.ai/docs/image-inference/inpainting#seed-and-mask-image-the-foundation) (guide)

### [maskMargin](https://runware.ai/docs/image-inference/api-reference#request-maskmargin)

- **Type**: `integer`
- **Min**: 32
- **Max**: 128

Adds extra context pixels around the masked region during inpainting. When this parameter is present, the model will zoom into the masked area, considering these additional pixels to create more coherent and well-integrated details.

This parameter is particularly effective when used with masks generated by the [Image Masking](https://runware.ai/docs/tools/image-masking) API, enabling enhanced detail generation while maintaining natural integration with the surrounding image.

**Learn more** (1 resource):

- [Inpainting: Selective image editing](https://runware.ai/docs/image-inference/inpainting#mask-margin-enhancing-detail) (guide)

### [strength](https://runware.ai/docs/image-inference/api-reference#request-strength)

- **Type**: `float`
- **Min**: 0
- **Max**: 1
- **Default**: 0.8

When doing image-to-image or inpainting, this parameter is used to determine the influence of the `seedImage` image in the generated output. A lower value results in more influence from the original image, while a higher value allows more creative deviation.

**Learn more** (3 resources):

- [Image-to-image: The art of AI-powered image transformation](https://runware.ai/docs/image-inference/image-to-image#strength-the-transformation-intensity) (guide)
- [Inpainting: Selective image editing](https://runware.ai/docs/image-inference/inpainting#strength-controlling-transformation-intensity) (guide)
- [Outpainting: Expanding image boundaries](https://runware.ai/docs/image-inference/outpainting#strength-understanding-the-critical-threshold) (guide)

### [referenceImages](https://runware.ai/docs/image-inference/api-reference#request-referenceimages)

- **Type**: `string[]`

An array containing reference images used to condition the generation process. These images provide visual guidance to help the model generate content that aligns with the style, composition, or characteristics of the reference materials.

This parameter is particularly useful with edit models like FLUX.1 Kontext, where reference images can guide the generation toward specific visual attributes or maintain consistency with existing content. Each image can be specified in one of the following formats:

- An UUID v4 string of a [previously uploaded image](https://runware.ai/docs/utilities/image-upload) or a generated image.
- A data URI string representing the image. The data URI must be in the format `data:<mediaType>;base64,` followed by the base64-encoded image. For example: `data:image/png;base64,iVBORw0KGgo...`.
- A base64 encoded image without the data URI prefix. For example: `iVBORw0KGgo...`.
- A URL pointing to the image. The image must be accessible publicly.

Supported formats are: PNG, JPG and WEBP.

**View model compatibility**:

| Model Architecture | Max Images    |
| ------------------ | ------------- |
| FLUX.1 Kontext     | 2             |
| Ace++              | 1             |
| Other models       | Not supported |

**Example**:

```json
{
  "taskType": "imageInference",
  "taskUUID": "a770f077-f413-47de-9dac-be0b26a35da6",
  "positivePrompt": "the same person as a chef in a restaurant kitchen",
  "model": "runware:106@1",
  "width": 1024,
  "height": 1024,
  "referenceImages": ["bb5d8e32-2f85-4b9c-c1e4-9f6e20a5d3b8"]
}
```

### [outpaint](https://runware.ai/docs/image-inference/api-reference#request-outpaint)

- **Path**: `outpaint.top`
- **Type**: `object (5 properties)`

Extends the image boundaries in specified directions. When using `outpaint`, you must provide the final dimensions using `width` and `height` parameters, which should account for the original image size plus the total extension (seedImage dimensions + top + bottom, left + right).

**Example**:

```json
{
  "taskType": "imageInference",
  "taskUUID": "d06e972d-dbfe-47d5-955f-c26e00ce4959",
  "positivePrompt": "a beautiful landscape with mountains and trees",
  "negativePrompt": "blurry, bad quality",
  "seedImage": "59a2edc2-45e6-429f-be5f-7ded59b92046",
  "model": "civitai:4201@130090",
  "height": 1024,
  "width": 768,
  "steps": 20,
  "strength": 0.7,
  "outpaint": {
    "top": 256,
    "right": 128,
    "bottom": 256,
    "left": 128,
    "blur": 16
  }
}
```

**Learn more** (1 resource):

- [Outpainting: Expanding image boundaries](https://runware.ai/docs/image-inference/outpainting#outpaint-defining-the-expansion) (guide)

#### [top](https://runware.ai/docs/image-inference/api-reference#request-outpaint-top)

- **Path**: `outpaint.top`
- **Type**: `integer`
- **Min**: 0

Number of pixels to extend at the top of the image. Must be a multiple of 64.

#### [right](https://runware.ai/docs/image-inference/api-reference#request-outpaint-right)

- **Path**: `outpaint.right`
- **Type**: `integer`
- **Min**: 0

Number of pixels to extend at the right side of the image. Must be a multiple of 64.

#### [bottom](https://runware.ai/docs/image-inference/api-reference#request-outpaint-bottom)

- **Path**: `outpaint.bottom`
- **Type**: `integer`
- **Min**: 0

Number of pixels to extend at the bottom of the image. Must be a multiple of 64.

#### [left](https://runware.ai/docs/image-inference/api-reference#request-outpaint-left)

- **Path**: `outpaint.left`
- **Type**: `integer`
- **Min**: 0

Number of pixels to extend at the left side of the image. Must be a multiple of 64.

#### [blur](https://runware.ai/docs/image-inference/api-reference#request-outpaint-blur)

- **Path**: `outpaint.blur`
- **Type**: `integer`
- **Min**: 0
- **Max**: 32
- **Default**: 0

The amount of blur to apply at the boundaries between the original image and the extended areas, measured in pixels.

**Learn more** (1 resource):

- [Outpainting: Expanding image boundaries](https://runware.ai/docs/image-inference/outpainting#outpaint-defining-the-expansion) (guide)

### [height](https://runware.ai/docs/image-inference/api-reference#request-height)

- **Type**: `integer`
- **Required**: true
- **Min**: 128
- **Max**: 2048

Used to define the height dimension of the generated image. Certain models perform better with specific dimensions.

The value must be divisible by 64, eg: 128...512, 576, 640...2048.

**Learn more** (2 resources):

- [Inpainting: Selective image editing](https://runware.ai/docs/image-inference/image-to-image#dimensions-changing-aspect-ratio) (guide)
- [Image-to-image: The art of AI-powered image transformation](https://runware.ai/docs/image-inference/outpainting#dimensions-critical-for-outpainting) (guide)

### [width](https://runware.ai/docs/image-inference/api-reference#request-width)

- **Type**: `integer`
- **Required**: true
- **Min**: 128
- **Max**: 2048

Used to define the width dimension of the generated image. Certain models perform better with specific dimensions.

The value must be divisible by 64, eg: 128...512, 576, 640...2048.

**Learn more** (2 resources):

- [Image-to-image: The art of AI-powered image transformation](https://runware.ai/docs/image-inference/image-to-image#dimensions-changing-aspect-ratio) (guide)
- [Outpainting: Expanding image boundaries](https://runware.ai/docs/image-inference/outpainting#dimensions-critical-for-outpainting) (guide)

### [resolution](https://runware.ai/docs/image-inference/api-reference#request-resolution)

- **Type**: `"1k" | "2k" | "4k"`
- **Default**: 1k

Controls the output resolution tier when the aspect ratio is automatically determined from reference images. The parameter selects the closest matching dimensions from the available resolutions in that tier.

**Available values**:

- `1k`: Produces images around ~1 megapixel (e.g., 1024×1024 for 1:1, 1344×768 for 16:9, 1248×832 for 3:2).
- `2k`: Produces images around ~4 megapixels (e.g., 2048×2048 for 1:1, 2688×1536 for 16:9, 2496×1664 for 3:2).
- `4k`: Produces images around ~16 megapixels (e.g., 4096×4096 for 1:1, 5376×3072 for 16:9, 4992×3328 for 3:2).

> [!WARNING]
> Available resolution tiers vary by model. Check the specific model's technical specifications to see which resolution values are supported.

The exact dimensions are selected based on the aspect ratio of the first reference image, using the closest available resolution from the chosen tier.

This parameter only applies to image-to-image workflows where aspect ratio is determined from reference images. For text-to-image generation, specify exact dimensions using [width](#request-width) and [height](#request-height) parameters.

### [model](https://runware.ai/docs/image-inference/api-reference#request-model)

- **Type**: `string`
- **Required**: true

We make use of the [AIR](https://runware.ai/docs/image-inference/models#air-system) (Artificial Intelligence Resource) system to identify models. This identifier is a unique string that represents a specific model.

You can find the AIR identifier of the model you want to use in our [Model Explorer](https://my.runware.ai/models/all), which is a tool that allows you to search for models based on their characteristics.

**Learn more** (3 resources):

- [Text to image: Turning words into pictures with AI](https://runware.ai/docs/image-inference/text-to-image#model-selection-the-foundation-of-generation) (guide)
- [Inpainting: Selective image editing](https://runware.ai/docs/image-inference/inpainting#model-specialized-inpainting-models) (guide)
- [Outpainting: Expanding image boundaries](https://runware.ai/docs/image-inference/outpainting#other-critical-parameters) (guide)

### [vae](https://runware.ai/docs/image-inference/api-reference#request-vae)

- **Type**: `string`

We make use of the [AIR](https://runware.ai/docs/image-inference/models#air-system) (Artificial Intelligence Resource) system to identify VAE models. This identifier is a unique string that represents a specific model.

The VAE (Variational Autoencoder) can be specified to override the default one included with the base model, which can help improve the quality of generated images.

You can find the AIR identifier of the VAE model you want to use in our [Model Explorer](https://my.runware.ai/models/all), which is a tool that allows you to search for models based on their characteristics.

**Learn more** (1 resource):

- [Text to image: Turning words into pictures with AI](https://runware.ai/docs/image-inference/text-to-image#vae-visual-decoder) (guide)

### [steps](https://runware.ai/docs/image-inference/api-reference#request-steps)

- **Type**: `integer`
- **Min**: 1
- **Max**: 100
- **Default**: 20

The number of steps is the number of iterations the model will perform to generate the image. The higher the number of steps, the more detailed the image will be. However, increasing the number of steps will also increase the time it takes to generate the image and may not always result in a better image (some [schedulers](#request-scheduler) work differently).

When using your own models you can specify a new default value for the number of steps.

**Learn more** (1 resource):

- [Text to image: Turning words into pictures with AI](https://runware.ai/docs/image-inference/text-to-image#steps-trading-quality-for-speed) (guide)

### [scheduler](https://runware.ai/docs/image-inference/api-reference#request-scheduler)

- **Type**: `string`
- **Default**: Model's scheduler

An scheduler is a component that manages the inference process. Different schedulers can be used to achieve different results like more detailed images, faster inference, or more accurate results.

The default scheduler is the one that the model was trained with, but you can choose a different one to get different results.

Schedulers are explained in more detail in the [Schedulers page](https://runware.ai/docs/image-inference/schedulers).

**Learn more** (2 resources):

- [Text to image: Turning words into pictures with AI](https://runware.ai/docs/image-inference/text-to-image#scheduler-the-algorithmic-path-to-your-image) (guide)
- [Outpainting: Expanding image boundaries](https://runware.ai/docs/image-inference/outpainting#other-critical-parameters) (guide)

### [seed](https://runware.ai/docs/image-inference/api-reference#request-seed)

- **Type**: `integer`
- **Min**: 1
- **Max**: 9223372036854776000
- **Default**: Random

A seed is a value used to randomize the image generation. If you want to make images reproducible (generate the same image multiple times), you can use the same seed value.

**Note**: Random seeds are generated as 32-bit values for platform compatibility, but you can specify any value if your platform supports it (JavaScript safely supports up to 53-bit integers).

**Learn more** (1 resource):

- [Text to image: Turning words into pictures with AI](https://runware.ai/docs/image-inference/text-to-image#seed-controlling-randomness-deterministically) (guide)

### [CFGScale](https://runware.ai/docs/image-inference/api-reference#request-cfgscale)

- **Type**: `float`
- **Min**: 0
- **Max**: 50
- **Default**: 7

Guidance scale represents how closely the images will resemble the prompt or how much freedom the AI model has. Higher values are closer to the prompt. Low values may reduce the quality of the results.

**Learn more** (1 resource):

- [Text to image: Turning words into pictures with AI](https://runware.ai/docs/image-inference/text-to-image#cfg-scale-balancing-creativity-and-control) (guide)

### [clipSkip](https://runware.ai/docs/image-inference/api-reference#request-clipskip)

- **Type**: `integer`
- **Min**: 0
- **Max**: 2

Defines additional layer skips during prompt processing in the CLIP model. Some models already skip layers by default, this parameter adds extra skips on top of those. Different values affect how your prompt is interpreted, which can lead to variations in the generated image.

**Learn more** (2 resources):

- [Text to image: Turning words into pictures with AI](http://runware.ai/docs/image-inference/text-to-image#clip-skip-adjusting-text-interpretation) (guide)
- [How to create stickers with AI: complete workflow with specialized LoRAs](https://runware.ai/blog/how-to-create-stickers-with-ai-complete-workflow-with-specialized-loras#clip-skip) (article)

### [promptWeighting](https://runware.ai/docs/image-inference/api-reference#request-promptweighting)

- **Type**: `string`

Defines the syntax to be used for prompt weighting.

Prompt weighting allows you to adjust how strongly different parts of your prompt influence the generated image. Choose between `compel` notation with advanced weighting operations or `sdEmbeds` for simple emphasis adjustments.

**View Compel syntax**:

Adds 0.2 seconds to image inference time and incurs additional costs.

When `compel` syntax is selected, you can use the following notation in prompts:

**Weighting**

Syntax: `+` `-` `(word)0.9`

Increase or decrease the attention given to specific words or phrases.

Examples:

- Single words: `small+ dog, pixar style`
- Multiple words: `small dog, (pixar style)-`
- Multiple symbols for more effect: `small+++ dog, pixar style`
- Nested weighting: `(small+ dog)++, pixar style`
- Explicit weight percentage: `small dog, (pixar)1.2 style`

**Blend**

Syntax: `.blend()`

Merge multiple conditioning prompts.

Example: `("small dog", "robot").blend(1, 0.8)`

**Conjunction**

Syntax: `.and()`

Break a prompt into multiple clauses and pass them separately.

Example: `("small dog", "pixar style").and()`

**View sdEmbeds syntax**:

When `sdEmbeds` syntax is selected, you can use the following notation in prompts:

**Weighting**

Syntax: `(text)` `(text:number)` `[text]`

Use parentheses `()` to increase attention, square brackets `[]` to decrease it. Add a number after the text to specify a custom multiplier.

Examples:

- Single words: `(small) dog, pixar style`
- Multiple words: `small dog, [pixar style]`
- Higher emphasis: `(small:2.5) dog, pixar style`
- Combined emphasis: `(small dog:1.5), pixar style`

### [numberResults](https://runware.ai/docs/image-inference/api-reference#request-numberresults)

- **Type**: `integer`
- **Min**: 1
- **Max**: 20
- **Default**: 1

Specifies how many images to generate for the given parameters. Each image will have the same parameters but different seeds, resulting in variations of the same concept.

### [acceleration](https://runware.ai/docs/image-inference/api-reference#request-acceleration)

- **Type**: `"none" | "low" | "medium" | "high"`
- **Default**: none

Applies optimized acceleration presets that automatically configure multiple generation parameters for the best speed and quality balance. This parameter serves as an abstraction layer that intelligently adjusts `acceleratorOptions`, `steps`, `scheduler`, and other underlying settings.

**Available values**:

- `none`: No acceleration applied, uses default parameter values.
- `low`: Minimal acceleration with optimized settings for lowest quality loss.
- `medium`: Balanced acceleration preset with moderate speed improvements.
- `high`: Maximum acceleration with caching and aggressive optimizations for fastest generation.

> [!NOTE]
> Acceleration presets serve as a base configuration that can be overridden. You can still manually specify `scheduler`, `steps`, `acceleratorOptions`, and other parameters to customize the preset's default values.

> [!WARNING]
> When overriding individual parameters on top of acceleration presets, results may be unexpected since the preset's optimized parameter combinations are designed to work together. Manual overrides may interfere with the preset's performance optimizations.

### [advancedFeatures](https://runware.ai/docs/image-inference/api-reference#request-advancedfeatures)

- **Path**: `advancedFeatures.layerDiffuse`
- **Type**: `object (2 properties)`

A container for specialized features that extend the functionality of the generation process. This object groups advanced capabilities that enhance specific aspects of the generation pipeline.

#### [layerDiffuse](https://runware.ai/docs/image-inference/api-reference#request-advancedfeatures-layerdiffuse)

- **Path**: `advancedFeatures.layerDiffuse`
- **Type**: `boolean`
- **Default**: false

Enables LayerDiffuse technology, which allows for the direct generation of images with transparency (alpha channels).

When enabled, this feature applies the necessary LoRA and VAE components to produce high-quality transparent images without requiring post-processing background removal.

This is particularly useful for creating product images, overlays, composites, and other content that requires transparency. The output must be in a format that supports transparency, such as PNG.

Note: This feature is only available for the FLUX model architecture. It automatically applies the equivalent of:

```json

  "lora": [{ "model": "runware:120@2" }],
  "vae": "runware:120@4"
```

**Example**:

```json
{
  "taskType": "imageInference",
  "taskUUID": "991e641a-d2a8-4aa3-9883-9d6fe230fff8",
  "outputFormat": "png",
  "positivePrompt": "a crystal glass",
  "height": 1024,
  "width": 1024,
  "advancedFeatures": {
    "layerDiffuse": true
  },
  "model": "runware:101@1"
}
```

**Learn more** (1 resource):

- [Introducing LayerDiffuse: Generate images with built-in transparency in one step](https://runware.ai/blog/introducing-layerdiffuse-generate-images-with-built-in-transparency-in-one-step) (article)

#### [hiresfix](https://runware.ai/docs/image-inference/api-reference#request-advancedfeatures-hiresfix)

- **Path**: `advancedFeatures.hiresfix`
- **Type**: `boolean`
- **Default**: false

Enables a two-stage generation process that produces higher-resolution images with improved detail quality. When enabled, the model first generates an image at native resolution, then upscales and refines it through a second sampling pass.

This technique helps overcome the limitations of models trained primarily on specific resolutions by allowing the model to refine upscaled content rather than generating directly at high resolution, which can result in better composition and reduced artifacts.

### [acceleratorOptions](https://runware.ai/docs/image-inference/api-reference#request-acceleratoroptions)

- **Path**: `acceleratorOptions.teaCache`
- **Type**: `object (12 properties)`

Advanced caching mechanisms to significantly speed up generation by reducing redundant computation. This object allows you to enable and configure acceleration technologies for your specific model architecture.

> [!WARNING]
> These caching methods will not perform well with stochastic schedulers (those with `SDE` or `Ancestral` in the name). The random noise added by these schedulers prevents the cache from working effectively. For best results, use deterministic schedulers like `Euler` or `DDIM`.

#### [teaCache](https://runware.ai/docs/image-inference/api-reference#request-acceleratoroptions-teacache)

- **Path**: `acceleratorOptions.teaCache`
- **Type**: `boolean`
- **Default**: false

Enables or disables the TeaCache feature, which accelerates generation by reusing past computations.

TeaCache is specifically designed for transformer-based models such as Flux and SD 3, and does not work with UNet models like SDXL or SD 1.5.

This feature is particularly effective for iterative editing and prompt refinement workflows.

**Example**:

```json
"acceleratorOptions": {
  "teaCache": true,
  "teaCacheDistance": 0.6
}
```

#### [teaCacheDistance](https://runware.ai/docs/image-inference/api-reference#request-acceleratoroptions-teacachedistance)

- **Path**: `acceleratorOptions.teaCacheDistance`
- **Type**: `float`
- **Min**: 0
- **Max**: 1
- **Default**: 0.5

Controls the aggressiveness of the TeaCache feature. Values range from 0.0 (most conservative) to 1.0 (most aggressive).

Lower values prioritize quality by being more selective about which computations to reuse, while higher values prioritize speed by reusing more computations.

Example: A value of 0.1 is very conservative, maintaining high quality with modest speed improvements, while 0.6 is more aggressive, yielding greater speed gains with potential minor quality trade-offs.

#### [fbCache](https://runware.ai/docs/image-inference/api-reference#request-acceleratoroptions-fbcache)

- **Path**: `acceleratorOptions.fbCache`
- **Type**: `boolean`
- **Default**: false

Enables or disables the First Block Cache (FBCache) feature, which accelerates generation by caching the first transformer block's output and reusing it when changes between timesteps are minimal. This optimization can provide significant speed improvements for transformer-based models.

**Example**:

```json
"acceleratorOptions": {
  "fbCache": true,
  "fbCacheThreshold": 0.25
}
```

#### [fbCacheThreshold](https://runware.ai/docs/image-inference/api-reference#request-acceleratoroptions-fbcachethreshold)

- **Path**: `acceleratorOptions.fbCacheThreshold`
- **Type**: `float`
- **Min**: 0
- **Max**: 1
- **Default**: 0.25

Controls the sensitivity threshold for determining when to reuse cached computations. Lower values are more conservative and prioritize quality, while higher values are more aggressive and prioritize speed.

#### [deepCache](https://runware.ai/docs/image-inference/api-reference#request-acceleratoroptions-deepcache)

- **Path**: `acceleratorOptions.deepCache`
- **Type**: `boolean`
- **Default**: false

Enables or disables the DeepCache feature, which speeds up diffusion-based image generation by caching internal feature maps from the neural network.

DeepCache is designed for UNet-based models like SDXL and SD 1.5, and is not applicable to transformer-based models like Flux and SD 3.

DeepCache can provide significant performance improvements for high-throughput scenarios or when generating multiple similar images.

**Example**:

```json
"acceleratorOptions": {
  "deepCache": true,
  "deepCacheInterval": 3,
  "deepCacheBranchId": 0
}
```

#### [deepCacheInterval](https://runware.ai/docs/image-inference/api-reference#request-acceleratoroptions-deepcacheinterval)

- **Path**: `acceleratorOptions.deepCacheInterval`
- **Type**: `integer`
- **Min**: 1
- **Default**: 3

Represents the frequency of feature caching, specified as the number of steps between each cache operation.

A larger interval value will make inference faster but may impact quality. A smaller interval prioritizes quality over speed.

#### [deepCacheBranchId](https://runware.ai/docs/image-inference/api-reference#request-acceleratoroptions-deepcachebranchid)

- **Path**: `acceleratorOptions.deepCacheBranchId`
- **Type**: `integer`
- **Min**: 0
- **Default**: 0

Determines which branch of the network (ordered from the shallowest to the deepest layer) is responsible for executing the caching processes.

Lower branch IDs (e.g., 0) result in more aggressive caching for faster generation, while higher branch IDs produce more conservative caching with potentially higher quality results.

#### [cacheStartStep](https://runware.ai/docs/image-inference/api-reference#request-acceleratoroptions-cachestartstep)

- **Path**: `acceleratorOptions.cacheStartStep`
- **Type**: `integer`
- **Min**: 0
- **Max**: {steps}

Alternative parameters: `acceleratorOptions.cacheStartStepPercentage`.

Specifies the inference step number at which caching mechanisms should begin. This allows fine control over when acceleration features activate during the generation process.

It can take values from `0` (first step) to the number of [steps](#request-steps) specified.

#### [cacheStartStepPercentage](https://runware.ai/docs/image-inference/api-reference#request-acceleratoroptions-cachestartsteppercentage)

- **Path**: `acceleratorOptions.cacheStartStepPercentage`
- **Type**: `integer`
- **Min**: 0
- **Max**: 99

Alternative parameters: `acceleratorOptions.cacheStartStep`.

Specifies the percentage of total inference steps at which caching mechanisms should begin. This provides a relative way to control when acceleration features activate, independent of the total step count.

It can take values from `0` to `99`.

#### [cacheEndStep](https://runware.ai/docs/image-inference/api-reference#request-acceleratoroptions-cacheendstep)

- **Path**: `acceleratorOptions.cacheEndStep`
- **Type**: `integer`
- **Min**: {cacheStartStep + 1}
- **Max**: {steps}

Alternative parameters: `acceleratorOptions.cacheEndStepPercentage`.

Specifies the inference step number at which caching mechanisms should stop.

It can take values higher than [cacheStartStep](#request-acceleratoroptions-cachestartstep) and less than or equal to the number of [steps](#request-steps) specified.

#### [cacheEndStepPercentage](https://runware.ai/docs/image-inference/api-reference#request-acceleratoroptions-cacheendsteppercentage)

- **Path**: `acceleratorOptions.cacheEndStepPercentage`
- **Type**: `integer`
- **Min**: {cacheStartStepPercentage + 1}
- **Max**: 100

Alternative parameters: `acceleratorOptions.cacheEndStep`.

Specifies the percentage of total inference steps at which caching mechanisms should stop.

It can take values higher than [cacheStartStepPercentage](#request-acceleratoroptions-cachestartsteppercentage) and lower than or equal to `100`.

#### [cacheMaxConsecutiveSteps](https://runware.ai/docs/image-inference/api-reference#request-acceleratoroptions-cachemaxconsecutivesteps)

- **Path**: `acceleratorOptions.cacheMaxConsecutiveSteps`
- **Type**: `integer`
- **Min**: 1
- **Max**: 5
- **Default**: 3

Limits the maximum number of consecutive steps that can use cached computations before forcing a fresh computation. This prevents quality degradation that can occur from extended cache reuse and ensures periodic refresh of the generation process.

### [puLID](https://runware.ai/docs/image-inference/api-reference#request-pulid)

- **Path**: `puLID.inputImages`
- **Type**: `object (5 properties)`

PuLID (Pure and Lightning ID Customization) enables fast and high-quality identity customization for text-to-image generation. This object allows you to configure settings for transferring facial characteristics from a reference image to generated images with high fidelity.

**Example**:

```json
{
  "taskType": "imageInference",
  "taskUUID": "991e641a-d2a8-4aa3-9883-9d6fe230fff8",
  "positivePrompt": "portrait, color, cinematic, in garden, soft light, detailed face",
  "height": 1024,
  "width": 1024,
  "model": "runware:101@1",
  "puLID": {
    "inputImages": ["59a2edc2-45e6-429f-be5f-7ded59b92046"],
    "idWeight": 1,
    "trueCFGScale": 1.5,
    "CFGStartStep": 3
  }
}
```

#### [inputImages](https://runware.ai/docs/image-inference/api-reference#request-pulid-inputimages)

- **Path**: `puLID.inputImages`
- **Type**: `string[]`
- **Required**: true
- **Min**: 1
- **Max**: 1

An array containing the reference image used for identity customization. The reference image provides the facial characteristics that will be preserved and integrated into the generated images.

Currently, only a single image is supported, so the array should contain exactly one element with a clear, high-quality face that will serve as the identity source.

The image can be specified in one of the following formats:

- An UUID v4 string of a [previously uploaded image](https://runware.ai/docs/utilities/image-upload) or a [generated image](https://runware.ai/docs/image-inference/api-reference).
- A data URI string representing the image. The data URI must be in the format `data:<mediaType>;base64,` followed by the base64-encoded image. For example: `data:image/png;base64,iVBORw0KGgo...`.
- A base64 encoded image without the data URI prefix. For example: `iVBORw0KGgo...`.
- A URL pointing to the image. The image must be accessible publicly.

Supported formats are: PNG, JPG and WEBP.

#### [idWeight](https://runware.ai/docs/image-inference/api-reference#request-pulid-idweight)

- **Path**: `puLID.idWeight`
- **Type**: `integer`
- **Min**: 0
- **Max**: 3
- **Default**: 1

Controls the strength of identity preservation in the generated image. Higher values create outputs that more closely resemble the facial characteristics of the input image, while lower values allow for more creative interpretation while still maintaining some identity features.

#### [trueCFGScale](https://runware.ai/docs/image-inference/api-reference#request-pulid-truecfgscale)

- **Path**: `puLID.trueCFGScale`
- **Type**: `float`
- **Min**: 0
- **Max**: 10

Controls the guidance scale specifically for PuLID's identity embedding process. This parameter modifies how closely the generated image follows the identity characteristics from the reference image while balancing prompt adherence.

Higher values result in stronger identity preservation and more faithful reproduction of facial features from the reference image. Lower values allow for more creative interpretation while still maintaining recognizable identity features.

This parameter works in conjunction with the main [CFGScale](https://runware.ai/docs/image-inference/api-reference#request-cfgscale) parameter but specifically targets the identity embedding component of the generation process.

#### [CFGStartStep](https://runware.ai/docs/image-inference/api-reference#request-pulid-cfgstartstep)

- **Path**: `puLID.CFGStartStep`
- **Type**: `integer`
- **Min**: 0
- **Max**: 10

Alternative parameters: `puLID.CFGstartStepPercentage`.

Controls when identity features begin to influence the image generation process.

Lower values apply identity features earlier in the generation process, resulting in stronger resemblance to the reference face but with less creative freedom in composition and style. Higher values do the opposite.

For photorealistic images, starting as early as possible typically works best. For stylized images (cartoon, anime, etc.), starting a bit later can provide better results.

#### [CFGStartStepPercentage](https://runware.ai/docs/image-inference/api-reference#request-pulid-cfgstartsteppercentage)

- **Path**: `puLID.CFGStartStepPercentage`
- **Type**: `integer`
- **Min**: 0
- **Max**: 100

Alternative parameters: `puLID.CFGstartStep`.

Determines at what percentage of the total generation steps the identity features begin to influence the image.

Lower percentages apply identity features earlier in the generation process, creating stronger resemblance to the reference face but with less creative freedom in composition and style. Higher percentages do the opposite.

For photorealistic images, starting as early as possible typically works best. For stylized images (cartoon, anime, etc.), starting a bit later can provide better results.

### [acePlusPlus](https://runware.ai/docs/image-inference/api-reference#request-aceplusplus)

- **Path**: `acePlusPlus.type`
- **Type**: `object (4 properties)`

ACE++ is an advanced framework for character-consistent image generation and editing. It supports two distinct workflows: creating new images guided by a reference image, and editing existing images with precise control over specific regions.

Note: When using the `acePlusPlus` object, you must set the [model](https://runware.ai/docs/image-inference/api-reference#request-model) parameter to `runware:102@1` (FLUX Fill).

> [!NOTE]
> The [referenceImages](https://runware.ai/docs/image-inference/api-reference#request-referenceimages) parameter is required when using ACE++ and must be specified at the root level of the request, outside of the `acePlusPlus` object.

**Example**:

**Creation Workflow:** Generate new images that maintain the style, identity, or characteristics from a reference image. The model extracts visual features from the reference image and combines them with the text prompt to condition the generation process.

```json
{
  "taskType": "imageInference",
  "taskUUID": "991e641a-d2a8-4aa3-9883-9d6fe230fff8",
  "positivePrompt": "photo of man wearing a suit",
  "height": 1024,
  "width": 1024,
  "model": "runware:102@1",
  "referenceImages": ["59a2edc2-45e6-429f-be5f-7ded59b92046"],
  "acePlusPlus": {
    "type": "portrait",
    "repaintingScale": 0.5
  }
}
```

**Editing Workflow:** Modify specific regions of an existing image using guidance from a reference image. Uses an input mask to define the exact area to be edited while preserving the rest of the image unchanged.

```json
{
  "taskType": "imageInference",
  "taskUUID": "991e641a-d2a8-4aa3-9883-9d6fe230fff8",
  "positivePrompt": "photo of man wearing a white t-shirt",
  "height": 1024,
  "width": 1024,
  "model": "runware:102@1",
  "referenceImages": ["59a2edc2-45e6-429f-be5f-7ded59b92046"],
  "acePlusPlus": {
    "type": "local_editing",
    "inputImages": ["59a2edc2-45e6-429f-be5f-7ded59b92046"],
    "inputMasks": ["90422a52-f186-4bf4-a73b-0a46016a8330"],
    "repaintingScale": 0.7
  }
}
```

#### [type](https://runware.ai/docs/image-inference/api-reference#request-aceplusplus-type)

- **Path**: `acePlusPlus.type`
- **Type**: `string`
- **Required**: true
- **Default**: portrait

Specifies the nature of the image processing task, which determines the appropriate model configuration and LoRA weights to use within the ACE++ framework.

**Available task types:**

- `portrait`: Ensures consistency in facial features across different images, maintaining identity and expression. Ideal for generating consistent character appearances in various settings.
- `subject`: Maintains consistency of specific subjects (objects, logos, etc.) across different scenes or contexts. Perfect for placing logos consistently on various products or backgrounds.
- `local_editing`: Facilitates localized editing of images, allowing modification of specific regions while preserving the overall structure. Used for targeted edits like changing object colors or altering facial features.

Each task type automatically applies the corresponding specialized LoRA model optimized for that specific use case.

#### [inputImages](https://runware.ai/docs/image-inference/api-reference#request-aceplusplus-inputimages)

- **Path**: `acePlusPlus.inputImages`
- **Type**: `string[]`
- **Max**: 1

An array containing the reference image(s) used for character identity. Each input image must contain a single, clear face of the subject.

Currently, only a single image is supported, so the array should contain exactly one element.

This reference images provides the character identity (face, style, etc.) that will be preserved during generation or editing.

The images can be specified in one of the following formats:

- An UUID v4 string of a [previously uploaded image](https://runware.ai/docs/utilities/image-upload) or a [generated image](https://runware.ai/docs/image-inference/api-reference).
- A data URI string representing the image. The data URI must be in the format `data:<mediaType>;base64,` followed by the base64-encoded image. For example: `data:image/png;base64,iVBORw0KGgo...`.
- A base64 encoded image without the data URI prefix. For example: `iVBORw0KGgo...`.
- A URL pointing to the image. The image must be accessible publicly.

Supported formats are: PNG, JPG and WEBP.

#### [inputMasks](https://runware.ai/docs/image-inference/api-reference#request-aceplusplus-inputmasks)

- **Path**: `acePlusPlus.inputMasks`
- **Type**: `string[]`
- **Max**: 1

An array containing the mask image(s) used for selective editing.

Currently, only a single mask is supported, so if provided, the array should contain exactly one element.

This parameter is used only in editing operations. The mask specifies which areas of the image should be edited based on the prompt, while preserving the rest of the image. The mask image can be specified in the same formats as `inputImages`.

The mask should be a black and white image where white (255) represents the areas to be edited and black (0) represents the areas to be preserved.

The mask images can be specified in one of the following formats:

- An UUID v4 string of a [previously uploaded image](https://runware.ai/docs/utilities/image-upload) or a [generated image](https://runware.ai/docs/image-inference/api-reference).
- A data URI string representing the image. The data URI must be in the format `data:<mediaType>;base64,` followed by the base64-encoded image. For example: `data:image/png;base64,iVBORw0KGgo...`.
- A base64 encoded image without the data URI prefix. For example: `iVBORw0KGgo...`.
- A URL pointing to the image. The image must be accessible publicly.

Supported formats are: PNG, JPG and WEBP.

#### [repaintingScale](https://runware.ai/docs/image-inference/api-reference#request-aceplusplus-repaintingscale)

- **Path**: `acePlusPlus.repaintingScale`
- **Type**: `float`
- **Min**: 0
- **Max**: 1
- **Default**: 0

Controls the balance between preserving the original character identity and following the prompt instructions.

A value of 0.0 gives maximum priority to character identity preservation, while a value of 1.0 gives maximum priority to following the prompt instructions.

For subtle changes while maintaining strong character resemblance, use lower values.

### [ultralytics](https://runware.ai/docs/image-inference/api-reference#request-ultralytics)

- **Path**: `ultralytics.maskBlur`
- **Type**: `object (8 properties)`

Configuration object for Ultralytics face enhancement during generation. This feature uses face detection and inpainting to improve facial details in the same generation step, without requiring post-processing.

> [!NOTE]
> Face enhancement is available for Stable Diffusion 1.X, SDXL, and FLUX models. The system automatically detects faces and applies targeted refinement to improve quality while maintaining consistency with the overall generation.

**Example**:

```json
{
  "taskType": "imageInference",
  "taskUUID": "a770f077-f413-47de-9dac-be0b26a35da6",
  "model": "runware:101@1",
  "positivePrompt": "portrait of a person in natural lighting",
  "width": 1024,
  "height": 1024,
  "ultralytics": {
    "maskBlur": 5,
    "confidence": 0.5,
    "CFGScale": 8,
    "strength": 0.3
  }
}
```

#### [maskBlur](https://runware.ai/docs/image-inference/api-reference#request-ultralytics-maskblur)

- **Path**: `ultralytics.maskBlur`
- **Type**: `integer`
- **Min**: 0
- **Max**: 100
- **Default**: 5

Controls the amount of feathering applied to the face mask edges. Higher values create softer transitions between the enhanced face region and surrounding areas, helping blend the refinement seamlessly into the image.

#### [maskPadding](https://runware.ai/docs/image-inference/api-reference#request-ultralytics-maskpadding)

- **Path**: `ultralytics.maskPadding`
- **Type**: `integer`
- **Min**: 0
- **Max**: 20
- **Default**: 5

Specifies padding in pixels around the detected face region. This expands the refinement area beyond the strict face boundaries to include surrounding context like hair, neck, and background transitions for more natural results.

#### [confidence](https://runware.ai/docs/image-inference/api-reference#request-ultralytics-confidence)

- **Path**: `ultralytics.confidence`
- **Type**: `float`
- **Min**: 0
- **Max**: 1
- **Default**: 0.5

Sets the dilation radius for the detected face bounding box region. This parameter affects how aggressively the face detection area is expanded, with higher values enlarging the refinement zone.

#### [positivePrompt](https://runware.ai/docs/image-inference/api-reference#request-ultralytics-positiveprompt)

- **Path**: `ultralytics.positivePrompt`
- **Type**: `string`

Text description guiding the face refinement process. This prompt specifically influences how facial details are enhanced, allowing you to emphasize particular characteristics or qualities in the improved face region.

#### [negativePrompt](https://runware.ai/docs/image-inference/api-reference#request-ultralytics-negativeprompt)

- **Path**: `ultralytics.negativePrompt`
- **Type**: `string`

Text description of elements to avoid during face refinement. Use this to prevent unwanted artifacts or characteristics when enhancing facial details.

#### [steps](https://runware.ai/docs/image-inference/api-reference#request-ultralytics-steps)

- **Path**: `ultralytics.steps`
- **Type**: `integer`
- **Min**: 1
- **Max**: 100
- **Default**: 20

Number of diffusion steps applied during face refinement. More steps generally produce higher quality facial details but increase processing time.

#### [CFGScale](https://runware.ai/docs/image-inference/api-reference#request-ultralytics-cfgscale)

- **Path**: `ultralytics.CFGScale`
- **Type**: `float`
- **Min**: 0
- **Max**: 50
- **Default**: 8

Classifier-Free Guidance scale for the face refinement process. Higher values make the refinement follow the prompt more closely, while lower values allow more variation.

#### [strength](https://runware.ai/docs/image-inference/api-reference#request-ultralytics-strength)

- **Path**: `ultralytics.strength`
- **Type**: `float`
- **Min**: 0
- **Max**: 1
- **Default**: 0.3

Denoising strength applied during face refinement. Lower values preserve more of the original generation while still improving details, while higher values allow more aggressive reconstruction of facial features.

### [refiner](https://runware.ai/docs/image-inference/api-reference#request-refiner)

- **Path**: `refiner.model`
- **Type**: `object (3 properties)`

Refiner models help create higher quality image outputs by incorporating specialized models designed to enhance image details and overall coherence. This can be particularly useful when you need results with superior quality, photorealism, or specific aesthetic refinements. Note that refiner models are only SDXL based.

The `refiner` parameter is an object that contains properties defining how the refinement process should be configured. You can find the properties of the refiner object below.

**Example**:

```json
{
  "taskType": "imageInference",
  "taskUUID": "a1b3c3d4-e5f6-7890-abcd-ef1234567890",
  "positivePrompt": "a highly detailed portrait of a wise old wizard with a long beard",
  "model": "civitai:139562@297320",
  "height": 1024,
  "width": 1024,
  "steps": 40,
  "refiner": {
    "model": "civitai:101055@128080",
    "startStep": 30
  }
}
```

**Learn more** (1 resource):

- [Text to image: Turning words into pictures with AI](https://runware.ai/docs/image-inference/text-to-image#refiner-two-stage-generation) (guide)

#### [model](https://runware.ai/docs/image-inference/api-reference#request-refiner-model)

- **Path**: `refiner.model`
- **Type**: `string`
- **Required**: true

We make use of the [AIR system](https://github.com/civitai/civitai/wiki/AIR-%E2%80%90-Uniform-Resource-Names-for-AI) to identify refiner models. This identifier is a unique string that represents a specific model. Note that refiner models are only SDXL based.

You can find the AIR identifier of the refiner model you want to use in our [Model Explorer](https://my.runware.ai/models/all), which is a tool that allows you to search for models based on their characteristics.

The official SDXL refiner model is `civitai:101055@128080`.

More information about the AIR system can be found in the [Models page](https://runware.ai/docs/image-inference/models).

#### [startStep](https://runware.ai/docs/image-inference/api-reference#request-refiner-startstep)

- **Path**: `refiner.startStep`
- **Type**: `integer`
- **Min**: 2
- **Max**: {steps}

Alternative parameters: `refiner.startStepPercentage`.

Represents the step number at which the refinement process begins. The initial model will generate the image up to this step, after which the refiner model takes over to enhance the result.

It can take values from `2` (second step) to the number of [steps](#request-steps) specified.

#### [startStepPercentage](https://runware.ai/docs/image-inference/api-reference#request-refiner-startsteppercentage)

- **Path**: `refiner.startStepPercentage`
- **Type**: `integer`
- **Min**: 1
- **Max**: 99

Alternative parameters: `refiner.startStep`.

Represents the percentage of total steps at which the refinement process begins. The initial model will generate the image up to this percentage of steps before the refiner takes over.

It can take values from `1` to `99`.

### [embeddings](https://runware.ai/docs/image-inference/api-reference#request-embeddings)

- **Path**: `embeddings[].model`
- **Type**: `object[] (2 properties)`

Embeddings (or Textual Inversion) can be used to add specific concepts or styles to your generations. Multiple embeddings can be used at the same time.

The `embeddings` parameter is an array of objects. Each object contains properties that define which embedding model to use. You can find the properties of the embeddings object below.

**Example**:

```json
{
  "taskType": "imageInference",
  "taskUUID": "string",
  "positivePrompt": "string",
  "model": "string",
  "height": int,
  "width": int,
  "numberResults": int,
  "embeddings": [
    {
      "model": "string",
    },
    {
      "model": "string",
    }
  ]
}
```

**Learn more** (1 resource):

- [Text to image: Turning words into pictures with AI](https://runware.ai/docs/image-inference/text-to-image#embeddings-custom-concepts) (guide)

#### [model](https://runware.ai/docs/image-inference/api-reference#request-embeddings-model)

- **Path**: `embeddings[].model`
- **Type**: `string`
- **Required**: true

We make use of the [AIR system](https://runware.ai/docs/image-inference/models#air-system) to identify embeddings models. This identifier is a unique string that represents a specific model.

You can find the AIR identifier of the embeddings model you want to use in our [Model Explorer](https://my.runware.ai/models/all), which is a tool that allows you to search for models based on their characteristics.

#### [weight](https://runware.ai/docs/image-inference/api-reference#request-embeddings-weight)

- **Path**: `embeddings[].weight`
- **Type**: `float`
- **Min**: -4
- **Max**: 4
- **Default**: 1

Defines the strength or influence of the embeddings model in the generation process. The value can range from -4 (negative influence) to +4 (maximum influence).

It is possible to use multiple embeddings at the same time.

Example:

```json
"embeddings": [
  { "model": "civitai:1044536@1172007", "weight": 1.5 },
  { "model": "civitai:993446@1113094", "weight": 0.8 }
]
```

### [controlNet](https://runware.ai/docs/image-inference/api-reference#request-controlnet)

- **Path**: `controlNet[].model`
- **Type**: `object[] (8 properties)`

With ControlNet, you can provide a guide image to help the model generate images that align with the desired structure. This guide image can be generated with our [ControlNet preprocessing tool](https://runware.ai/docs/tools/controlnet-preprocess), extracting guidance information from an input image. The guide image can be in the form of an edge map, a pose, a depth estimation or any other type of control image that guides the generation process via the ControlNet model.

Multiple ControlNet models can be used at the same time to provide different types of guidance information to the model.

The `controlNet` parameter is an array of objects. Each object contains properties that define the configuration for a specific ControlNet model. You can find the properties of the ControlNet object below.

**Example**:

```json
{
  "taskType": "imageInference",
  "taskUUID": "string",
  "positivePrompt": "string",
  "model": "string",
  "height": int,
  "width": int,
  "numberResults": int,
  "controlNet": [
    {
      "model": "string",
      "guideImage": "string",
      "weight": float,
      "startStep": int,
      "endStep": int,
      "controlMode": "string"
    },
    {
      "model": "string",
      "guideImage": "string",
      "weight": float,
      "startStep": int,
      "endStep": int,
      "controlMode": "string"
    }
  ]
}
```

**Learn more** (2 resources):

- [Creating consistent gaming assets with ControlNet Canny](https://runware.ai/blog/creating-consistent-gaming-assets-with-controlnet-canny#controlnet-and-edge-detection) (article)
- [Text to image: Turning words into pictures with AI](https://runware.ai/docs/image-inference/text-to-image#controlnet-structural-guidance) (guide)

#### [model](https://runware.ai/docs/image-inference/api-reference#request-controlnet-model)

- **Path**: `controlNet[].model`
- **Type**: `string`
- **Required**: true

For basic/common ControlNet models, you can check the list of available models [here](https://runware.ai/docs/image-inference/models#basic-controlnet-models).

For custom or specific ControlNet models, we make use of the [AIR system](https://github.com/civitai/civitai/wiki/AIR-%E2%80%90-Uniform-Resource-Names-for-AI) to identify ControlNet models. This identifier is a unique string that represents a specific model.

You can find the AIR identifier of the ControlNet model you want to use in our [Model Explorer](https://my.runware.ai/models/all), which is a tool that allows you to search for models based on their characteristics.

More information about the AIR system can be found in the [Models page](https://runware.ai/docs/image-inference/models).

#### [guideImage](https://runware.ai/docs/image-inference/api-reference#request-controlnet-guideimage)

- **Path**: `controlNet[].guideImage`
- **Type**: `string`
- **Required**: true

Specifies the preprocessed image to be used as guide to control the image generation process. The image can be specified in one of the following formats:

- An UUID v4 string of a [previously uploaded image](https://runware.ai/docs/utilities/image-upload) or a [generated image](https://runware.ai/docs/image-inference/api-reference).
- A data URI string representing the image. The data URI must be in the format `data:<mediaType>;base64,` followed by the base64-encoded image. For example: `data:image/png;base64,iVBORw0KGgo...`.
- A base64 encoded image without the data URI prefix. For example: `iVBORw0KGgo...`.
- A URL pointing to the image. The image must be accessible publicly.

Supported formats are: PNG, JPG and WEBP.

#### [weight](https://runware.ai/docs/image-inference/api-reference#request-controlnet-weight)

- **Path**: `controlNet[].weight`
- **Type**: `float`
- **Min**: 0
- **Max**: 1
- **Default**: 1

Represents the strength or influence of this ControlNet model in the generation process. A value of 0 means no influence, while 1 means maximum influence.

#### [startStep](https://runware.ai/docs/image-inference/api-reference#request-controlnet-startstep)

- **Path**: `controlNet[].startStep`
- **Type**: `integer`
- **Min**: 1
- **Max**: {steps}

Alternative parameters: `controlNet.startStepPercentage`.

Represents the step number at which the ControlNet model starts to control the inference process.

It can take values from `1` (first step) to the number of [steps](#request-steps) specified.

**Learn more** (1 resource):

- [Creating consistent gaming assets with ControlNet Canny](https://runware.ai/blog/creating-consistent-gaming-assets-with-controlnet-canny#controlnet-parameters) (article)

#### [startStepPercentage](https://runware.ai/docs/image-inference/api-reference#request-controlnet-startsteppercentage)

- **Path**: `controlNet[].startStepPercentage`
- **Type**: `integer`
- **Min**: 0
- **Max**: 99

Alternative parameters: `controlNet.startStep`.

Represents the percentage of steps at which the ControlNet model starts to control the inference process.

It can take values from `0` to `99`.

**Learn more** (1 resource):

- [Creating consistent gaming assets with ControlNet Canny](https://runware.ai/blog/creating-consistent-gaming-assets-with-controlnet-canny#controlnet-parameters) (article)

#### [endStep](https://runware.ai/docs/image-inference/api-reference#request-controlnet-endstep)

- **Path**: `controlNet[].endStep`
- **Type**: `integer`
- **Min**: {startStep + 1}
- **Max**: {steps}

Alternative parameters: `controlNet.endStepPercentage`.

Represents the step number at which the ControlNet preprocessor ends to control the inference process.

It can take values higher than [startStep](#request-controlnet-startstep) and less than or equal to the number of [steps](#request-steps) specified.

**Learn more** (1 resource):

- [Creating consistent gaming assets with ControlNet Canny](https://runware.ai/blog/creating-consistent-gaming-assets-with-controlnet-canny#controlnet-parameters) (article)

#### [endStepPercentage](https://runware.ai/docs/image-inference/api-reference#request-controlnet-endsteppercentage)

- **Path**: `controlNet[].endStepPercentage`
- **Type**: `integer`
- **Min**: {startStepPercentage + 1}
- **Max**: 100

Alternative parameters: `controlNet.endStep`.

Represents the percentage of steps at which the ControlNet model ends to control the inference process.

It can take values higher than [startStepPercentage](#request-controlnet-startsteppercentage) and lower than or equal to `100`.

**Learn more** (1 resource):

- [Creating consistent gaming assets with ControlNet Canny](https://runware.ai/blog/creating-consistent-gaming-assets-with-controlnet-canny#controlnet-parameters) (article)

#### [controlMode](https://runware.ai/docs/image-inference/api-reference#request-controlnet-controlmode)

- **Path**: `controlNet[].controlMode`
- **Type**: `string`

This parameter has 3 options: `prompt`, `controlnet` and `balanced`.

- `prompt`: Prompt is more important in guiding image generation.
- `controlnet`: ControlNet is more important in guiding image generation.
- `balanced`: Balanced operation of prompt and ControlNet.

### [lora](https://runware.ai/docs/image-inference/api-reference#request-lora)

- **Path**: `lora[].model`
- **Type**: `object[] (2 properties)`

With LoRA (Low-Rank Adaptation), you can adapt a model to specific styles or features by emphasizing particular aspects of the data. This technique enhances the quality and relevance of generated content and can be especially useful when the output needs to adhere to a specific artistic style or follow particular guidelines.

Multiple LoRA models can be used simultaneously to achieve different adaptation goals.

The `lora` parameter is an array of objects. Each object contains properties that define the configuration for a specific LoRA model.

**Example**:

```json
{
  "taskType": "imageInference",
  "taskUUID": "string",
  "positivePrompt": "string",
  "model": "string",
  "height": int,
  "width": int,
  "lora": [
    {
      "model": "string",
      "weight": float
    }
  ]
}
```

**Learn more** (1 resource):

- [Text to image: Turning words into pictures with AI](https://runware.ai/docs/image-inference/text-to-image#loras-style-and-subject-adapters) (guide)

#### [model](https://runware.ai/docs/image-inference/api-reference#request-lora-model)

- **Path**: `lora[].model`
- **Type**: `string`
- **Required**: true

We make use of the [AIR system](https://github.com/civitai/civitai/wiki/AIR-%E2%80%90-Uniform-Resource-Names-for-AI) to identify LoRA models. This identifier is a unique string that represents a specific model.

You can find the AIR identifier of the LoRA model you want to use in our [Model Explorer](https://my.runware.ai/models/all), which is a tool that allows you to search for models based on their characteristics.

More information about the AIR system can be found in the [Models page](https://runware.ai/docs/image-inference/models).

Example: `civitai:132942@146296`.

#### [weight](https://runware.ai/docs/image-inference/api-reference#request-lora-weight)

- **Path**: `lora[].weight`
- **Type**: `float`
- **Min**: -4
- **Max**: 4
- **Default**: 1

Defines the strength or influence of the LoRA model in the generation process. The value can range from -4 (negative influence) to +4 (maximum influence).

Multiple LoRAs can be used simultaneously with different weights to achieve complex adaptations.

**Example**:

```json
"lora": [
  { "model": "runware:13090@1", "weight": 1.5 },
  { "model": "runware:6638@1", "weight": 0.8 }
]
```

### [ipAdapters](https://runware.ai/docs/image-inference/api-reference#request-ipadapters)

- **Path**: `ipAdapters[].model`
- **Type**: `object[] (3 properties)`

IP-Adapters enable image-prompted generation, allowing you to use reference images to guide the style and content of your generations. Multiple IP Adapters can be used simultaneously.

The `ipAdapters` parameter is an array of objects. Each object contains properties that define which IP-Adapter model to use and how it should influence the generation.

**Basic properties:**

- `model` (string, required): IP-Adapter model identifier.
- `guideImage` (string, required): Reference image UUID, URL, data URI, or base64.
- `weight` (float, optional): Influence strength (0-1, default varies by model).

**View advanced IP-Adapter parameters**:

These parameters provide fine-grained control over how IP-Adapters process and apply image embeddings. Most users won't need these, the defaults work well for typical use cases.

**`combineMethod`** (string, default: `concat`): Controls how multiple reference images are combined.

- `concat`: Concatenate embeddings end-to-end (treats each image distinctly).
- `add`: Element-wise sum of all embeddings.
- `subtract`: Subtract subsequent embeddings from the first.
- `average`: Arithmetic mean of all embeddings (smooth blending).
- `norm_average`: Normalized average, reducing extreme outliers.

**`embedScaling`** (string, default: `kv`): Determines which embedding components are used and their strength.

- `only_v`: Use only value vectors (weaker conditioning, text prompt dominates).
- `kv`: Use both key and value vectors (stronger image conditioning).
- `kv_penalty_c`: K+V with channel penalty (balanced conditioning).
- `k_mean_v_penalty_c`: Averaged key with penalized value (subtle effect).

**`weightType`** (string, default: `normal`): Shapes how influence evolves during generation.

- `normal`: Uniform weighting throughout.
- `ease_in`: Gradually increases influence.
- `ease_out`: Gradually decreases influence.
- `ease_in_out`: Smooth rise and fall.
- `weak_input` / `weak_output` / `weak_middle` / `strong_middle`: Layer-specific weighting.
- `style_transfer`: Emphasizes style over content.
- `composition`: Emphasizes layout and structure.
- `strong_style_transfer` / `style_and_composition` / `strong_style_and_composition`: Combined emphasis modes.

**`weightComposition`** (float, `0-1`): Controls composition/layout influence specifically. Lower values reduce layout influence while maintaining style; higher values increase structural adherence to the reference image.

> [!NOTE]
> Advanced parameters work in combination. For example, `weightType: "style_transfer"` with `embedScaling: "kv"` provides strong style conditioning, while `weightComposition: 0.3` limits how much the layout is preserved.

**Example**:

```json
{
  "taskType": "imageInference",
  "taskUUID": "a770f077-f413-47de-9dac-be0b26a35da6",
  "positivePrompt": "portrait of a person in autumn park, professional photography",
  "model": "civitai:140737@329420",
  "height": 1024,
  "width": 1024,
  "ipAdapters": [
    {
      "model": "runware:55@3",
      "guideImages": ["c64351d5-4c59-42f7-95e1-eace013eddab"],
      "weight": 0.75
    },
    {
      "model": "runware:55@1",
      "guideImages": ["d7e8f9a0-2b5c-4e7f-a1d3-9c8b7a6e5d4f"],
      "weight": 0.5,
      "combineMethod": "average",
      "weightType": "style_transfer",
      "embedScaling": "kv",
      "weightComposition": 0.3
    }
  ]
}
```

**Learn more** (1 resource):

- [Image-to-image: The art of AI-powered image transformation](https://runware.ai/docs/image-inference/image-to-image#ip-adapters-reference-based-generation) (guide)

#### [model](https://runware.ai/docs/image-inference/api-reference#request-ipadapters-model)

- **Path**: `ipAdapters[].model`
- **Type**: `string`
- **Required**: true

We make use of the [AIR system](https://runware.ai/docs/image-inference/models#air-system) to identify IP-Adapter models. This identifier is a unique string that represents a specific model.

**Supported models list**:

| AIR ID        | Model Name                  |
| ------------- | --------------------------- |
| runware:55@1  | IP Adapter SDXL             |
| runware:55@2  | IP Adapter SDXL Plus        |
| runware:55@3  | IP Adapter SDXL Plus Face   |
| runware:55@4  | IP Adapter SDXL Vit-H       |
| runware:55@5  | IP Adapter SD 1.5           |
| runware:55@6  | IP Adapter SD 1.5 Plus      |
| runware:55@7  | IP Adapter SD 1.5 Light     |
| runware:55@8  | IP Adapter SD 1.5 Plus Face |
| runware:55@10 | IP Adapter SD 1.5 Vit-G     |

#### [guideImages](https://runware.ai/docs/image-inference/api-reference#request-ipadapters-guideimages)

- **Path**: `ipAdapters[].guideImages`
- **Type**: `string[]`
- **Required**: true

Specifies the reference images that will guide the generation process. The images can be specified in one of the following formats:

- An UUID v4 string of a [previously uploaded image](https://runware.ai/docs/utilities/image-upload) or a [generated image](https://runware.ai/docs/image-inference/api-reference).
- A data URI string representing the image. The data URI must be in the format `data:<mediaType>;base64,` followed by the base64-encoded image. For example: `data:image/png;base64,iVBORw0KGgo...`.
- A base64 encoded image without the data URI prefix. For example: `iVBORw0KGgo...`.
- A URL pointing to the image. The image must be accessible publicly.

Supported formats are: PNG, JPG and WEBP.

#### [weight](https://runware.ai/docs/image-inference/api-reference#request-ipadapters-weight)

- **Path**: `ipAdapters[].weight`
- **Type**: `float`
- **Min**: 0
- **Max**: 1
- **Default**: 1

Represents the strength or influence of this IP-Adapter in the generation process. A value of 0 means no influence, while 1 means maximum influence.

### [providerSettings](https://runware.ai/docs/image-inference/api-reference#request-providersettings)

- **Path**: `providerSettings.alibaba`
- **Type**: `object (43 properties)`

Contains provider-specific configuration settings that customize the behavior of different AI models and services. Each provider has its own set of parameters that control various aspects of the generation process.

The `providerSettings` parameter is an object that contains nested objects for each supported provider.

#### [alibaba](https://runware.ai/docs/image-inference/api-reference#request-providersettings-alibaba)

- **Path**: `providerSettings.alibaba`
- **Type**: `object (1 property)`

Configuration object for Alibaba-specific image generation settings. These parameters provide control over prompt enhancement for Wan image models.

**Example**:

```json
{
  "taskType": "imageInference",
  "taskUUID": "a770f077-f413-47de-9dac-be0b26a35da6",
  "model": "alibaba:wan@2.5-image",
  "positivePrompt": "A cinematic still with rich detail",
  "width": 1280,
  "height": 1280,
  "providerSettings": {
    "alibaba": {
      "promptExtend": true
    }
  }
}
```

##### [promptExtend](https://runware.ai/docs/image-inference/api-reference#request-providersettings-alibaba-promptextend)

- **Path**: `providerSettings.alibaba.promptExtend`
- **Type**: `boolean`
- **Default**: true

Enables LLM-based prompt rewriting to improve generation quality by expanding and clarifying the input prompt. When enabled, the system analyzes and enhances the prompt to produce more detailed and coherent video output.

> [!NOTE]
> Enabling prompt extension increases generation time but typically results in higher quality output with better scene composition and narrative flow.

#### [bfl](https://runware.ai/docs/image-inference/api-reference#request-providersettings-bfl)

- **Path**: `providerSettings.bfl`
- **Type**: `object (3 properties)`

Configuration object for Black Forest Labs (BFL) specific features. BFL models offer advanced prompt processing and content safety controls.

**Example**:

```json
{
  "taskType": "imageInference",
  "taskUUID": "a770f077-f413-47de-9dac-be0b26a35da6",
  "positivePrompt": "a beautiful landscape at sunset",
  "model": "bfl:1@1",
  "width": 1024,
  "height": 1024,
  "providerSettings": {
    "bfl": {
      "promptUpsampling": true,
      "safetyTolerance": 6
    }
  }
}
```

##### [promptUpsampling](https://runware.ai/docs/image-inference/api-reference#request-providersettings-bfl-promptupsampling)

- **Path**: `providerSettings.bfl.promptUpsampling`
- **Type**: `boolean`
- **Default**: false

Enables automatic enhancement and expansion of the input prompt to improve generation quality and detail.

When enabled, BFL's prompt upsampling system analyzes your text description and adds relevant details and descriptive elements that enhance the final output without changing the core intent of your prompt.

##### [safetyTolerance](https://runware.ai/docs/image-inference/api-reference#request-providersettings-bfl-safetytolerance)

- **Path**: `providerSettings.bfl.safetyTolerance`
- **Type**: `integer`
- **Min**: 0
- **Max**: 6
- **Default**: 2

Controls the tolerance level for input and output content moderation. Lower values apply stricter content filtering, while higher values are more permissive. Range from 0 (most strict) to 6 (least strict).

##### [raw](https://runware.ai/docs/image-inference/api-reference#request-providersettings-bfl-raw)

- **Path**: `providerSettings.bfl.raw`
- **Type**: `boolean`
- **Default**: false

Controls the level of post-processing applied to generated images.

When enabled, the raw mode produces images that are closer to the model's direct output without additional processing layers. This can result in more natural-looking images but may sacrifice some visual polish and consistency that post-processing typically provides.

#### [bria](https://runware.ai/docs/image-inference/api-reference#request-providersettings-bria)

- **Path**: `providerSettings.bria`
- **Type**: `object (11 properties)`

Configuration object for Bria-specific features and controls. Bria models offer enterprise-safe AI with built-in content moderation, IP protection, and licensed training data for commercial use.

##### [promptEnhancement](https://runware.ai/docs/image-inference/api-reference#request-providersettings-bria-promptenhancement)

- **Path**: `providerSettings.bria.promptEnhancement`
- **Type**: `boolean`
- **Default**: false

Enhances the input prompt with descriptive variations and additional details for more creative and varied outputs. When enabled, the system expands the prompt while maintaining the original intent.

##### [medium](https://runware.ai/docs/image-inference/api-reference#request-providersettings-bria-medium)

- **Path**: `providerSettings.bria.medium`
- **Type**: `"photography" | "art"`

Specifies the artistic medium or style category for generation, influencing the overall aesthetic and rendering approach.

**Available values**:

- `photography`: Optimizes for photorealistic imagery with natural lighting and textures.
- `art`: Optimizes for artistic interpretations with stylized rendering and creative expression.

##### [enhanceImage](https://runware.ai/docs/image-inference/api-reference#request-providersettings-bria-enhanceimage)

- **Path**: `providerSettings.bria.enhanceImage`
- **Type**: `boolean`
- **Default**: false

Generates images with richer details and sharper textures by applying additional enhancement processing to the output. This improves overall visual quality and clarity.

##### [promptContentModeration](https://runware.ai/docs/image-inference/api-reference#request-providersettings-bria-promptcontentmoderation)

- **Path**: `providerSettings.bria.promptContentModeration`
- **Type**: `boolean`
- **Default**: true

Scans the input prompt for NSFW or restricted terms before generation begins. When enabled, requests with flagged content are rejected before processing to ensure safe commercial use.

##### [contentModeration](https://runware.ai/docs/image-inference/api-reference#request-providersettings-bria-contentmoderation)

- **Path**: `providerSettings.bria.contentModeration`
- **Type**: `boolean`
- **Default**: true

Applies content moderation to both input visuals and generated outputs, ensuring all content meets safety standards for commercial use. Flagged content results in request rejection.

##### [ipSignal](https://runware.ai/docs/image-inference/api-reference#request-providersettings-bria-ipsignal)

- **Path**: `providerSettings.bria.ipSignal`
- **Type**: `boolean`
- **Default**: false

Flags potential intellectual property-related content in the prompt or generated output. When enabled, helps identify potential IP conflicts before commercial use.

##### [mode](https://runware.ai/docs/image-inference/api-reference#request-providersettings-bria-mode)

- **Path**: `providerSettings.bria.mode`
- **Type**: `string`
- **Default**: base

Selects the background generation mode, controlling the balance between quality, speed, and prompt adherence.

**Available values**:

- `base`: Clean, high-quality backgrounds with good prompt following.
- `high_control`: Stronger prompt adherence with more precise scene control, ideal for detailed specifications.
- `fast`: Same capabilities as base mode, optimized for speed.

##### [enhanceReferenceImages](https://runware.ai/docs/image-inference/api-reference#request-providersettings-bria-enhancereferenceimages)

- **Path**: `providerSettings.bria.enhanceReferenceImages`
- **Type**: `boolean`
- **Default**: true

Applies additional enhancement logic to reference images for optimal background generation results.

> [!NOTE]
> This parameter only applies when using reference images via `inputs.references`. It has no effect in text prompt mode.

##### [refinePrompt](https://runware.ai/docs/image-inference/api-reference#request-providersettings-bria-refineprompt)

- **Path**: `providerSettings.bria.refinePrompt`
- **Type**: `boolean`
- **Default**: true

Automatically refines and optimizes the provided text prompt for better background generation quality.

##### [originalQuality](https://runware.ai/docs/image-inference/api-reference#request-providersettings-bria-originalquality)

- **Path**: `providerSettings.bria.originalQuality`
- **Type**: `boolean`
- **Default**: true

Controls output image resolution. When enabled, the output retains the original image size. When disabled, the output is scaled to 1MP (one megapixel) while preserving the original aspect ratio.

##### [forceBackgroundDetection](https://runware.ai/docs/image-inference/api-reference#request-providersettings-bria-forcebackgrounddetection)

- **Path**: `providerSettings.bria.forceBackgroundDetection`
- **Type**: `boolean`
- **Default**: false

Forces background detection even when the input image contains an alpha channel (transparency). Useful for refining background separation in images that already have transparency data.

#### [bytedance](https://runware.ai/docs/image-inference/api-reference#request-providersettings-bytedance)

- **Path**: `providerSettings.bytedance`
- **Type**: `object (2 properties)`

Configuration object for ByteDance-specific image generation settings. These parameters provide access to specialized features and controls available across ByteDance's image generation models.

**Example**:

```json
"providerSettings": {
  "bytedance": {
    "maxSequentialImages": 4
  }
}
```

##### [maxSequentialImages](https://runware.ai/docs/image-inference/api-reference#request-providersettings-bytedance-maxsequentialimages)

- **Path**: `providerSettings.bytedance.maxSequentialImages`
- **Type**: `integer`
- **Min**: 1
- **Max**: 15

Specifies the maximum number of sequential images to generate in a single request. This parameter enables the creation of coherent image sequences, making it ideal for storyboard development or comic creation.

The model will attempt to generate up to the specified number of images while maintaining visual consistency and thematic coherence across the sequence. Each image builds upon the previous ones to create a unified narrative flow.

> [!WARNING]
> The combined total of reference images plus sequential images cannot exceed 15. For example, if you use 5 reference images, you can request a maximum of 10 sequential images.

The model may generate fewer images than requested depending on prompt complexity and generation context. The actual number of output images is determined by the model's assessment of narrative coherence and visual quality.

##### [optimizePromptMode](https://runware.ai/docs/image-inference/api-reference#request-providersettings-bytedance-optimizepromptmode)

- **Path**: `providerSettings.bytedance.optimizePromptMode`
- **Type**: `"standard" | "fast"`
- **Default**: standard

Controls the prompt optimization mode, balancing quality and generation speed.

**Available values**:

- `standard`: Higher quality output with longer generation time.
- `fast`: Faster generation with average quality.

#### [ideogram](https://runware.ai/docs/image-inference/api-reference#request-providersettings-ideogram)

- **Path**: `providerSettings.ideogram`
- **Type**: `object (10 properties)`

Configuration object for Ideogram-specific image generation settings and controls. These parameters provide access to specialized features including rendering speed optimization, prompt enhancement, style controls, and advanced editing capabilities.

**Example**:

```json
{
  "taskType": "imageInference",
  "taskUUID": "a770f077-f413-47de-9dac-be0b26a35da6",
  "positivePrompt": "A vintage coffee shop sign with beautiful typography",
  "model": "ideogram:4@1",
  "width": 1024,
  "height": 1024,
  "providerSettings": {
    "ideogram": {
      "renderingSpeed": "QUALITY",
      "magicPrompt": "AUTO",
      "styleType": "DESIGN"
    }
  }
}
```

##### [renderingSpeed](https://runware.ai/docs/image-inference/api-reference#request-providersettings-ideogram-renderingspeed)

- **Path**: `providerSettings.ideogram.renderingSpeed`
- **Type**: `string`
- **Default**: DEFAULT

Controls the rendering speed and quality balance for image generation. Higher quality settings take longer but produce more refined results.

**Available values:**

- `TURBO`: Fastest generation with good quality (available for all models).
- `DEFAULT`: Balanced speed and quality (available for all models).
- `QUALITY`: Highest quality with slower generation (3.0 models only).

##### [magicPrompt](https://runware.ai/docs/image-inference/api-reference#request-providersettings-ideogram-magicprompt)

- **Path**: `providerSettings.ideogram.magicPrompt`
- **Type**: `string`
- **Default**: AUTO

Controls automatic prompt enhancement to improve generation quality and detail.

**Available values:**

- `AUTO`: Automatically determines whether to enhance the prompt based on content.
- `ON`: Always enhances the input prompt with additional descriptive details.
- `OFF`: Uses the prompt exactly as provided without enhancement.

##### [styleType](https://runware.ai/docs/image-inference/api-reference#request-providersettings-ideogram-styletype)

- **Path**: `providerSettings.ideogram.styleType`
- **Type**: `string`
- **Default**: AUTO

Specifies the visual style and rendering approach for the generated image.

**Available values for 3.0 models:**

- `AUTO`: Automatically selects the most appropriate style.
- `GENERAL`: Versatile style suitable for most content types.
- `REALISTIC`: Photorealistic rendering with natural lighting and textures.
- `DESIGN`: Optimized for graphic design, logos, and typography.
- `FICTION`: Stylized rendering for fictional and fantasy content.

**Available values for 1.0/2.0/2a models:**

- `AUTO`: Automatically selects the most appropriate style.
- `GENERAL`: Versatile style suitable for most content types.
- `REALISTIC`: Photorealistic rendering with natural lighting and textures.
- `DESIGN`: Optimized for graphic design, logos, and typography.
- `RENDER_3D`: Three-dimensional rendering style with depth and modeling effects.
- `ANIME`: Animated style with characteristic anime/manga visual elements.
- `FICTION`: Stylized rendering for fictional and fantasy content.

##### [styleReferenceImages](https://runware.ai/docs/image-inference/api-reference#request-providersettings-ideogram-stylereferenceimages)

- **Path**: `providerSettings.ideogram.styleReferenceImages`
- **Type**: `string[]`
- **Max**: 4

An array of reference images used to guide the visual style and aesthetic of the generated content. These images influence the overall look, color palette, and artistic approach without directly copying content.

Supports 1-4 reference images.

Each image can be specified in one of the following formats:

- An UUID v4 string of a previously uploaded image or a generated image.
- A data URI string representing the image. The data URI must be in the format `data:<mediaType>;base64,` followed by the base64-encoded image. For example: `data:image/png;base64,iVBORw0KGgo...`.
- A base64 encoded image without the data URI prefix. For example: `iVBORw0KGgo...`.
- A URL pointing to the image. The image must be accessible publicly.

Supported formats are: PNG, JPG and WEBP.

Style reference images work in combination with the `styleType` parameter to achieve the desired aesthetic.

##### [remixStrength](https://runware.ai/docs/image-inference/api-reference#request-providersettings-ideogram-remixstrength)

- **Path**: `providerSettings.ideogram.remixStrength`
- **Type**: `integer`
- **Min**: 1
- **Max**: 100
- **Default**: 50

Controls the intensity of transformation when using Remix models. Higher values create more dramatic changes while lower values preserve more of the original image characteristics.

##### [stylePreset](https://runware.ai/docs/image-inference/api-reference#request-providersettings-ideogram-stylepreset)

- **Path**: `providerSettings.ideogram.stylePreset`
- **Type**: `string`

Applies a predefined artistic style preset to guide the visual aesthetic and rendering approach of the generated image.

> [!NOTE]
> This parameter is only available for 3.0 models (ideogram:4@1, ideogram:4@2, ideogram:4@3, ideogram:4@4, ideogram:4@5).

**Available values**:

`80S_ILLUSTRATION`, `90S_NOSTALGIA`, `ABSTRACT_ORGANIC`, `ANALOG_NOSTALGIA`, `ART_BRUT`, `ART_DECO`, `ART_POSTER`, `AURA`, `AVANT_GARDE`, `BAUHAUS`, `BLUEPRINT`, `BLURRY_MOTION`, `BRIGHT_ART`, `C4D_CARTOON`, `CHILDRENS_BOOK`, `COLLAGE`, `COLORING_BOOK_I`, `COLORING_BOOK_II`, `CUBISM`, `DARK_AURA`, `DOODLE`, `DOUBLE_EXPOSURE`, `DRAMATIC_CINEMA`, `EDITORIAL`, `EMOTIONAL_MINIMAL`, `ETHEREAL_PARTY`, `EXPIRED_FILM`, `FLAT_ART`, `FLAT_VECTOR`, `FOREST_REVERIE`, `GEO_MINIMALIST`, `GLASS_PRISM`, `GOLDEN_HOUR`, `GRAFFITI_I`, `GRAFFITI_II`, `HALFTONE_PRINT`, `HIGH_CONTRAST`, `HIPPIE_ERA`, `ICONIC`, `JAPANDI_FUSION`, `JAZZY`, `LONG_EXPOSURE`, `MAGAZINE_EDITORIAL`, `MINIMAL_ILLUSTRATION`, `MIXED_MEDIA`, `MONOCHROME`, `NIGHTLIFE`, `OIL_PAINTING`, `OLD_CARTOONS`, `PAINT_GESTURE`, `POP_ART`, `RETRO_ETCHING`, `RIVIERA_POP`, `SPOTLIGHT_80S`, `STYLIZED_RED`, `SURREAL_COLLAGE`, `TRAVEL_POSTER`, `VINTAGE_GEO`, `VINTAGE_POSTER`, `WATERCOLOR`, `WEIRD`, `WOODBLOCK_PRINT`.

##### [styleCode](https://runware.ai/docs/image-inference/api-reference#request-providersettings-ideogram-stylecode)

- **Path**: `providerSettings.ideogram.styleCode`
- **Type**: `string`

An 8-character hexadecimal code that applies a specific predefined style to the generation. This provides an alternative way to control visual aesthetics beyond the standard style types.

> [!NOTE]
> Available only for specific 3.0 models (ideogram:4@2, ideogram:4@3, ideogram:4@4, ideogram:4@5).

> [!WARNING]
> Cannot be used together with `styleType` or `referenceImages` parameters.

##### [colorPalette](https://runware.ai/docs/image-inference/api-reference#request-providersettings-ideogram-colorpalette)

- **Path**: `providerSettings.ideogram.colorPalette`
- **Type**: `object`

Defines a color palette for generation using either preset color schemes or custom color combinations with optional weights.

> [!NOTE]
> This parameter is only available for Ideogram 2.0 (`ideogram:3@1`).

**Object properties:**

- `name` (string, optional): Preset color palette name. Available values: `EMBER`, `FRESH`, `JUNGLE`, `MAGIC`, `MELON`, `MOSAIC`, `PASTEL`, `ULTRAMARINE`.
- `members` (array, optional): Custom color palette with hex colors and optional weights.

**Members array objects:**

- `colorHex` (string, required): Hexadecimal color code (e.g., `#FF5733` or `#F73`).
- `colorWeight` (number, optional): Color influence weight between 0.05 and 1.0. Weights should descend from highest to lowest.

**Preset palette**:

```json
"colorPalette": {
  "name": "EMBER"
}
```

**Custom palette**:

```json
"colorPalette": {
  "members": [
    {
      "colorHex": "#FF5733",
      "colorWeight": 1.0
    },
    {
      "colorHex": "#C70039",
      "colorWeight": 0.7
    },
    {
      "colorHex": "#900C3F",
      "colorWeight": 0.3
    }
  ]
}
```

**Custom without weights**:

```json
"colorPalette": {
  "members": [
    {
      "colorHex": "#3498DB"
    },
    {
      "colorHex": "#2ECC71"
    },
    {
      "colorHex": "#F39C12"
    }
  ]
}
```

##### [characterReferenceImages](https://runware.ai/docs/image-inference/api-reference#request-providersettings-ideogram-characterreferenceimages)

- **Path**: `providerSettings.ideogram.characterReferenceImages`
- **Type**: `string[]`

An array containing character reference images used to preserve consistent character traits across generated images. This feature allows you to generate multiple images of the same character in different poses, scenes, or styles while maintaining core facial features, hairstyle, and other defining characteristics.

Each image can be specified in one of the following formats:

- An UUID v4 string of a previously uploaded image or a generated image.
- A data URI string representing the image. The data URI must be in the format `data:<mediaType>;base64,` followed by the base64-encoded image. For example: `data:image/png;base64,iVBORw0KGgo...`.
- A base64 encoded image without the data URI prefix. For example: `iVBORw0KGgo...`.
- A URL pointing to the image. The image must be accessible publicly.

Supported formats are: PNG, JPG and WEBP.

> [!NOTE]
> Maximum of 1 character reference image supported. When using `characterReferenceImagesMask`, the number of mask images must match the number of character reference images.

> [!NOTE]
> This parameter is only available for Ideogram 3.0 models (ideogram:4@1, ideogram:4@2, ideogram:4@3).

##### [characterReferenceImagesMask](https://runware.ai/docs/image-inference/api-reference#request-providersettings-ideogram-characterreferenceimagesmask)

- **Path**: `providerSettings.ideogram.characterReferenceImagesMask`
- **Type**: `string[]`

An array containing mask images that define which parts of the character reference image should be preserved during generation. The model automatically masks face and hair regions, but you can provide custom masks to control preservation of specific features like hairstyles, accessories, or facial attributes.

Masks allow fine-grained control over character consistency, for example, you can exclude a hat from the mask if you want to change it, or include specific accessories that should be preserved across variations.

Each mask image can be specified in one of the following formats:

- An UUID v4 string of a previously uploaded image or a generated image.
- A data URI string representing the image. The data URI must be in the format `data:<mediaType>;base64,` followed by the base64-encoded image. For example: `data:image/png;base64,iVBORw0KGgo...`.
- A base64 encoded image without the data URI prefix. For example: `iVBORw0KGgo...`.
- A URL pointing to the image. The image must be accessible publicly.

Supported formats are: PNG, JPG and WEBP.

> [!WARNING]
> The number of mask images must exactly match the number of `characterReferenceImages`. This parameter is optional, but when provided, the counts must align.

> [!NOTE]
> This parameter is only available for Ideogram 3.0 models (ideogram:4@1, ideogram:4@2, ideogram:4@3).

#### [midjourney](https://runware.ai/docs/image-inference/api-reference#request-providersettings-midjourney)

- **Path**: `providerSettings.midjourney`
- **Type**: `object (5 properties)`

Configuration object for Midjourney-specific generation settings. These parameters provide fine control over quality, artistic stylization, creative variation, and experimental effects.

**Example**:

```json
{
  "taskType": "imageInference",
  "taskUUID": "a770f077-f413-47de-9dac-be0b26a35da6",
  "positivePrompt": "Fantasy castle on a cliff at sunset",
  "model": "midjourney:3@1",
  "width": 1456,
  "height": 816,
  "providerSettings": {
    "midjourney": {
      "quality": 2,
      "stylize": 500,
      "chaos": 25
    }
  }
}
```

##### [quality](https://runware.ai/docs/image-inference/api-reference#request-providersettings-midjourney-quality)

- **Path**: `providerSettings.midjourney.quality`
- **Type**: `"0.25" | "0.5" | "1" | "2"`
- **Default**: 1

Controls how much computational effort Midjourney spends rendering the image. Higher values use more GPU time and improve fine details, texture accuracy and visual refinement, but increase generation time. This parameter does not affect final resolution or image format quality.

**Available values**:

- `0.25`: Very fast generation, simplified details, minimal refinement.
- `0.5`: Faster rendering with moderate detail quality.
- `1`: Default setting with a balanced level of detail and speed.
- `2`: Highest refinement and texture detail with significantly longer generation time.

> [!NOTE]
> Midjourney V7 only supports quality values of `1` and `2`.

##### [stylize](https://runware.ai/docs/image-inference/api-reference#request-providersettings-midjourney-stylize)

- **Path**: `providerSettings.midjourney.stylize`
- **Type**: `integer`
- **Min**: 0
- **Max**: 1000
- **Default**: 100

Governs how much Midjourney's artistic dataset style affects the image. Lower values follow the prompt more literally, while higher values apply more artistic interpretation and Midjourney's aesthetic training.

A value of 0 minimizes stylistic influence, while values approaching 1000 maximize artistic interpretation. Most use cases benefit from values between 50-500.

##### [chaos](https://runware.ai/docs/image-inference/api-reference#request-providersettings-midjourney-chaos)

- **Path**: `providerSettings.midjourney.chaos`
- **Type**: `integer`
- **Min**: 0
- **Max**: 100
- **Default**: 0

Controls variation and unpredictability in the generation process. A value of 0 disables chaos, producing consistent results for the same prompt. Higher values create more diverse and less predictable outputs, useful for creative exploration.

Values above 50 produce highly varied results, while values between 10-30 add subtle variation without dramatically changing the core composition.

##### [weird](https://runware.ai/docs/image-inference/api-reference#request-providersettings-midjourney-weird)

- **Path**: `providerSettings.midjourney.weird`
- **Type**: `integer`
- **Min**: 0
- **Max**: 3000
- **Default**: 0

Adds surreal and experimental characteristics to the generated image. A value of 0 disables the effect, producing conventional results. Higher values introduce increasingly abstract and unusual visual elements.

> [!WARNING]
> Very high values (e.g., 2000-3000) produce extreme and often impractical results. Most creative use cases work best with values between 100-1000.

##### [niji](https://runware.ai/docs/image-inference/api-reference#request-providersettings-midjourney-niji)

- **Path**: `providerSettings.midjourney.niji`
- **Type**: `"0" | "5" | "6" | "close"`
- **Default**: close

Selects the rendering engine, with specific support for anime-style generation through the Niji models.

**Available values**:

- `close`: Standard Midjourney rendering (default).
- `0`: Disable Niji mode.
- `5`: Niji 5 anime-style rendering.
- `6`: Niji 6 anime-style rendering (latest).

The Niji engines are optimized for anime and manga aesthetics, producing results with characteristic anime visual styles and techniques.

#### [openai](https://runware.ai/docs/image-inference/api-reference#request-providersettings-openai)

- **Path**: `providerSettings.openai`
- **Type**: `object (2 properties)`

Configuration object for OpenAI-specific image generation settings. These parameters provide control over output quality and background handling.

**Example**:

```json
{
  "taskType": "imageInference",
  "taskUUID": "a770f077-f413-47de-9dac-be0b26a35da6",
  "positivePrompt": "A professional product photo with clean background",
  "model": "openai:4@1",
  "width": 1024,
  "height": 1024,
  "providerSettings": {
    "openai": {
      "quality": "high",
      "background": "transparent"
    }
  }
}
```

##### [quality](https://runware.ai/docs/image-inference/api-reference#request-providersettings-openai-quality)

- **Path**: `providerSettings.openai.quality`
- **Type**: `"auto" | "high" | "medium" | "low"`
- **Default**: auto

Controls the quality level of the generated image. Higher quality settings produce more detailed and refined results but may take longer to generate.

**Available values**:

- `auto`: Automatically selects the optimal quality level based on the prompt and generation context.
- `high`: Maximum quality with enhanced detail and refinement.
- `medium`: Balanced quality suitable for most use cases.
- `low`: Faster generation with acceptable quality for rapid iteration.

##### [background](https://runware.ai/docs/image-inference/api-reference#request-providersettings-openai-background)

- **Path**: `providerSettings.openai.background`
- **Type**: `"auto" | "transparent" | "opaque"`
- **Default**: auto

Controls the background handling in generated images. This parameter determines whether the image has a solid background, transparent areas, or automatically determined background based on content.

**Available values**:

- `auto`: Automatically determines the most appropriate background treatment based on the prompt and content.
- `transparent`: Generates the image with transparent background areas where applicable.
- `opaque`: Ensures the entire background is filled with solid content, no transparency.

#### [prunaai](https://runware.ai/docs/image-inference/api-reference#request-providersettings-prunaai)

- **Path**: `providerSettings.prunaai`
- **Type**: `object (1 property)`

Configuration object for Pruna AI-specific image generation settings and optimization controls.

**Example**:

```json
{
  "taskType": "imageInference",
  "taskUUID": "a770f077-f413-47de-9dac-be0b26a35da6",
  "positivePrompt": "A product photograph with clean composition",
  "model": "prunaai:2@1",
  "width": 1024,
  "height": 1024,
  "providerSettings": {
    "prunaai": {
      "turbo": true
    }
  }
}
```

##### [turbo](https://runware.ai/docs/image-inference/api-reference#request-providersettings-prunaai-turbo)

- **Path**: `providerSettings.prunaai.turbo`
- **Type**: `boolean`
- **Default**: false

Enables additional performance optimizations for faster generation. When activated, the model applies aggressive acceleration techniques to reduce inference time.

> [!WARNING]
> For complex or detailed generation tasks, it is recommended to disable turbo mode to maintain optimal quality. Turbo mode prioritizes speed over subtle details.

## [Response](#response)

All inference operations return a consistent response format. Results arrive as they complete due to parallel processing.

```json
{
  "data": [
    {
      "taskType": "imageInference",
      "taskUUID": "a770f077-f413-47de-9dac-be0b26a35da6",
      "imageUUID": "77da2d99-a6d3-44d9-b8c0-ae9fb06b6200",
      "imageURL": "https://im.runware.ai/image/ws/0.5/ii/a770f077-f413-47de-9dac-be0b26a35da6.jpg",
      "cost": 0.0013
    }
  ]
}
```

---

### [taskType](https://runware.ai/docs/image-inference/api-reference#response-tasktype)

- **Type**: `string`

The API will return the `taskType` you sent in the request. In this case, it will be `imageInference`. This helps match the responses to the correct task type.

### [taskUUID](https://runware.ai/docs/image-inference/api-reference#response-taskuuid)

- **Type**: `string (UUID v4)`

The API will return the `taskUUID` you sent in the request. This way you can match the responses to the correct request tasks.

### [imageUUID](https://runware.ai/docs/image-inference/api-reference#response-imageuuid)

- **Type**: `string (UUID v4)`

A unique identifier for the output image. This UUID can be used to reference the image in subsequent operations or for tracking purposes.

The `imageUUID` is different from the `taskUUID`. While `taskUUID` identifies the request, `imageUUID` identifies the specific image output.

### [imageURL](https://runware.ai/docs/image-inference/api-reference#response-imageurl)

- **Type**: `string`

If `outputType` is set to `URL`, this parameter contains the URL of the image to be downloaded.

### [imageBase64Data](https://runware.ai/docs/image-inference/api-reference#response-imagebase64data)

- **Type**: `string`

If `outputType` is set to `base64Data`, this parameter contains the base64-encoded image data.

### [imageDataURI](https://runware.ai/docs/image-inference/api-reference#response-imagedatauri)

- **Type**: `string`

If `outputType` is set to `dataURI`, this parameter contains the data URI of the image.

### [seed](https://runware.ai/docs/image-inference/api-reference#response-seed)

- **Type**: `integer`

The seed value that was used to generate this image. This value can be used to reproduce the same image when using identical parameters in another request.

### [NSFWContent](https://runware.ai/docs/image-inference/api-reference#response-nsfwcontent)

- **Type**: `boolean`

If [safety](#request-safety) parameter is used, `NSFWContent` is included informing if the image has been flagged as potentially sensitive content.

- `true` indicates the image has been flagged (is a sensitive image).
- `false` indicates the image has not been flagged.

The filter occasionally returns false positives and very rarely false negatives.

### [cost](https://runware.ai/docs/image-inference/api-reference#response-cost)

- **Type**: `float`

if `includeCost` is set to `true`, the response will include a `cost` field for each task object. This field indicates the cost of the request in USD.
