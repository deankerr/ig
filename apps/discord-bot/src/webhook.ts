const MAX_SIGNATURE_AGE_MS = 5 * 60 * 1000

function hexToBytes(value: string) {
  if (value.length % 2 !== 0) {
    throw new Error('Invalid hex string length')
  }

  const bytes = new Uint8Array(value.length / 2)
  for (let index = 0; index < value.length; index += 2) {
    bytes[index / 2] = Number.parseInt(value.slice(index, index + 2), 16)
  }
  return bytes
}

export async function verifyDiscordWebhook(
  rawBody: string,
  signature: string | undefined,
  timestamp: string | undefined,
  publicKey: string,
) {
  if (!signature || !timestamp) return false

  const numericTimestamp = Number(timestamp) * 1000
  if (!Number.isFinite(numericTimestamp)) return false
  if (Math.abs(Date.now() - numericTimestamp) > MAX_SIGNATURE_AGE_MS) return false

  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', hexToBytes(publicKey), 'Ed25519', false, [
    'verify',
  ])

  return crypto.subtle.verify(
    'Ed25519',
    key,
    hexToBytes(signature),
    encoder.encode(timestamp + rawBody),
  )
}
