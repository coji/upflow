import { beforeEach, describe, expect, test, vi } from 'vitest'
import { verifyWebhookSignature } from '~/app/libs/webhook-verify.server'
import { processGithubWebhookPayload } from '~/app/services/github-webhook.server'
import { action } from './api.github.webhook'

vi.mock('~/app/libs/webhook-verify.server', () => ({
  verifyWebhookSignature: vi.fn(() => false),
}))

vi.mock('~/app/services/github-webhook.server', () => ({
  processGithubWebhookPayload: vi.fn(),
}))

const verify = vi.mocked(verifyWebhookSignature)
const process = vi.mocked(processGithubWebhookPayload)

function post(body: string, headers: Record<string, string>, method = 'POST') {
  const init: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Hub-Signature-256': `sha256=${'a'.repeat(64)}`,
      ...headers,
    },
  }
  if (method !== 'GET' && method !== 'HEAD') {
    init.body = body
  }
  return action({
    request: new Request('http://localhost/api/github/webhook', init),
  } as never)
}

describe('api.github.webhook', () => {
  beforeEach(() => {
    verify.mockReset()
    verify.mockReturnValue(false)
    process.mockReset()
    process.mockResolvedValue(undefined)
  })

  test('405 for non-POST', async () => {
    verify.mockReturnValue(true)
    const res = await post('{}', { 'X-GitHub-Event': 'ping' }, 'GET')
    expect(res.status).toBe(405)
    expect(process).not.toHaveBeenCalled()
  })

  test('401 when signature invalid', async () => {
    const res = await post('{}', { 'X-GitHub-Event': 'ping' })
    expect(res.status).toBe(401)
    expect(process).not.toHaveBeenCalled()
  })

  test('400 when JSON invalid', async () => {
    verify.mockReturnValue(true)
    const res = await post('not-json', { 'X-GitHub-Event': 'ping' })
    expect(res.status).toBe(400)
    expect(process).not.toHaveBeenCalled()
  })

  test('202 for unhandled event without calling processor', async () => {
    verify.mockReturnValue(true)
    const res = await post('{}', { 'X-GitHub-Event': 'ping' })
    expect(res.status).toBe(202)
    expect(process).not.toHaveBeenCalled()
  })

  test('204 for installation and calls processor', async () => {
    verify.mockReturnValue(true)
    const res = await post('{"action":"x"}', {
      'X-GitHub-Event': 'installation',
    })
    expect(res.status).toBe(204)
    expect(process).toHaveBeenCalledWith('installation', { action: 'x' })
  })

  test('500 when processor throws', async () => {
    verify.mockReturnValue(true)
    process.mockRejectedValue(new Error('db down'))
    const res = await post('{}', { 'X-GitHub-Event': 'installation' })
    expect(res.status).toBe(500)
  })
})
