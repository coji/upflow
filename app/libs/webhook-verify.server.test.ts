import { createHmac } from 'node:crypto'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { verifyWebhookSignature } from './webhook-verify.server'

function sign(body: string, secret: string) {
  const digest = createHmac('sha256', secret).update(body, 'utf8').digest('hex')
  return `sha256=${digest}`
}

describe('verifyWebhookSignature', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  test('returns true for valid signature', () => {
    vi.stubEnv('GITHUB_WEBHOOK_SECRET', 'my-secret')
    const body = '{"a":1}'
    expect(verifyWebhookSignature(body, sign(body, 'my-secret'))).toBe(true)
  })

  test('returns false without sha256= prefix', () => {
    vi.stubEnv('GITHUB_WEBHOOK_SECRET', 'my-secret')
    const body = '{}'
    const hex = createHmac('sha256', 'my-secret')
      .update(body, 'utf8')
      .digest('hex')
    expect(verifyWebhookSignature(body, hex)).toBe(false)
  })

  test('returns false when body is tampered', () => {
    vi.stubEnv('GITHUB_WEBHOOK_SECRET', 'my-secret')
    const body = '{"ok":true}'
    expect(verifyWebhookSignature(`${body}x`, sign(body, 'my-secret'))).toBe(
      false,
    )
  })

  test('returns false when secret differs', () => {
    vi.stubEnv('GITHUB_WEBHOOK_SECRET', 'secret-a')
    const body = '{}'
    expect(verifyWebhookSignature(body, sign(body, 'secret-b'))).toBe(false)
  })

  test('returns false when GITHUB_WEBHOOK_SECRET is unset', () => {
    vi.stubEnv('GITHUB_WEBHOOK_SECRET', '')
    const body = '{}'
    expect(verifyWebhookSignature(body, sign(body, 'x'))).toBe(false)
  })
})
