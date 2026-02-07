/**
 * fal.ai Webhook Signature Verification
 *
 * Verifies webhook requests using Ed25519 signatures and JWKS public keys.
 * See: https://docs.fal.ai/model-apis/model-endpoints/webhooks
 */

const JWKS_URL = 'https://rest.alpha.fal.ai/.well-known/jwks.json'
const TIMESTAMP_TOLERANCE_SECONDS = 300 // 5 minutes

type JWK = {
  kty: string
  crv: string
  x: string // base64url-encoded Ed25519 public key
  kid?: string
}

type JWKS = {
  keys: JWK[]
}

// Simple in-memory cache for JWKS
let cachedJwks: { keys: CryptoKey[]; fetchedAt: number } | null = null
const JWKS_CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

/**
 * Fetches and caches the JWKS from fal.ai
 */
async function getPublicKeys(): Promise<CryptoKey[]> {
  const now = Date.now()

  if (cachedJwks && now - cachedJwks.fetchedAt < JWKS_CACHE_TTL_MS) {
    return cachedJwks.keys
  }

  const response = await fetch(JWKS_URL)
  if (!response.ok) {
    throw new Error(`Failed to fetch JWKS: ${response.status}`)
  }

  const jwks = (await response.json()) as JWKS
  const keys: CryptoKey[] = []

  for (const jwk of jwks.keys) {
    if (jwk.kty !== 'OKP' || jwk.crv !== 'Ed25519') {
      continue
    }

    // Import the Ed25519 public key
    const key = await crypto.subtle.importKey(
      'jwk',
      {
        kty: jwk.kty,
        crv: jwk.crv,
        x: jwk.x,
      },
      { name: 'Ed25519' },
      false,
      ['verify'],
    )
    keys.push(key)
  }

  cachedJwks = { keys, fetchedAt: now }
  return keys
}

/**
 * Converts a hex string to Uint8Array
 */
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16)
  }
  return bytes
}

/**
 * Converts ArrayBuffer to hex string
 */
function bytesToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export type WebhookVerificationResult = { valid: true } | { valid: false; error: string }

/**
 * Verifies a fal.ai webhook request signature
 */
export async function verifyWebhook(
  headers: Headers,
  rawBody: ArrayBuffer,
): Promise<WebhookVerificationResult> {
  // Extract required headers
  const requestId = headers.get('x-fal-webhook-request-id')
  const userId = headers.get('x-fal-webhook-user-id')
  const timestamp = headers.get('x-fal-webhook-timestamp')
  const signature = headers.get('x-fal-webhook-signature')

  if (!requestId || !userId || !timestamp || !signature) {
    return { valid: false, error: 'Missing required webhook headers' }
  }

  // Validate timestamp (within 5 minutes)
  const timestampSeconds = parseInt(timestamp, 10)
  const nowSeconds = Math.floor(Date.now() / 1000)
  const timeDiff = Math.abs(nowSeconds - timestampSeconds)

  if (timeDiff > TIMESTAMP_TOLERANCE_SECONDS) {
    return { valid: false, error: `Timestamp too old: ${timeDiff}s difference` }
  }

  // Compute SHA-256 hash of the raw body
  const bodyHash = bytesToHex(await crypto.subtle.digest('SHA-256', rawBody))

  // Construct the message to verify
  const message = `${requestId}\n${userId}\n${timestamp}\n${bodyHash}`
  const messageBytes = new TextEncoder().encode(message)

  // Decode the signature from hex
  const signatureBytes = hexToBytes(signature)

  // Fetch public keys and attempt verification
  let publicKeys: CryptoKey[]
  try {
    publicKeys = await getPublicKeys()
  } catch (err) {
    return { valid: false, error: `Failed to fetch JWKS: ${err}` }
  }

  if (publicKeys.length === 0) {
    return { valid: false, error: 'No Ed25519 keys found in JWKS' }
  }

  // Try each public key
  for (const key of publicKeys) {
    try {
      const isValid = await crypto.subtle.verify(
        { name: 'Ed25519' },
        key,
        signatureBytes as BufferSource,
        messageBytes as BufferSource,
      )

      if (isValid) {
        return { valid: true }
      }
    } catch {
      // Key didn't work, try next one
      continue
    }
  }

  return { valid: false, error: 'Signature verification failed' }
}
