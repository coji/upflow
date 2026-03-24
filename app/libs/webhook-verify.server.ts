import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Verifies GitHub webhook `X-Hub-Signature-256` (HMAC-SHA256, hex digest).
 */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string,
): boolean {
  const secret = process.env.GITHUB_WEBHOOK_SECRET
  if (!secret) return false
  if (!signatureHeader.startsWith('sha256=')) return false
  const hex = signatureHeader.slice('sha256='.length)
  if (!/^[0-9a-f]{64}$/i.test(hex)) return false
  const theirBuf = Buffer.from(hex, 'hex')
  const ours = createHmac('sha256', secret).update(rawBody, 'utf8').digest()
  if (theirBuf.length !== ours.length) return false
  return timingSafeEqual(theirBuf, ours)
}
