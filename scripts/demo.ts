import { config } from 'dotenv'

config({ path: './scripts/.env' })

const BASE_URL = process.env.DEMO_URL ?? 'http://localhost:3000'
const API_KEY = process.env.API_KEY ?? ''

const falModel = 'fal-ai/flux/schnell'
const runwareModel = 'runware:100@1' // flux/schnell

const prompt = process.argv[2] ?? 'a cat wearing a tiny hat, photorealistic'
const providerArg = process.argv[3] as 'fal' | 'runware' | undefined
const numImages = 3

async function createGeneration(provider: 'fal' | 'runware', model: string, input: object) {
  const res = await fetch(`${BASE_URL}/api/generations/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
    },
    body: JSON.stringify({
      provider,
      model,
      input,
      tags: ['demo', `provider:${provider}`],
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`${provider} failed: ${res.status} ${text}`)
  }

  return res.json()
}

async function main() {
  console.log(`Prompt: "${prompt}"`)

  const runFal = !providerArg || providerArg === 'fal'
  const runRunware = !providerArg || providerArg === 'runware'

  if (runFal) {
    const result = await createGeneration('fal', falModel, {
      prompt,
      num_images: numImages,
    })
    console.log('fal:', result)
  }

  if (runRunware) {
    const result = await createGeneration('runware', runwareModel, {
      prompt,
      numberResults: numImages,
    })
    console.log('runware:', result)
  }
}

main().catch(console.error)
