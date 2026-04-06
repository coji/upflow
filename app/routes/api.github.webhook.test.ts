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

  test('204 for ping and delegates to processor (no-op in service)', async () => {
    verify.mockReturnValue(true)
    const res = await post('{}', { 'X-GitHub-Event': 'ping' })
    expect(res.status).toBe(204)
    expect(process).toHaveBeenCalledWith('ping', {})
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

  const prPayload = {
    action: 'opened',
    installation: { id: 1 },
    repository: { name: 'r', owner: { login: 'o' } },
    pull_request: { number: 2 },
  }

  test('204 for pull_request and delegates to processor', async () => {
    verify.mockReturnValue(true)
    const res = await post(JSON.stringify(prPayload), {
      'X-GitHub-Event': 'pull_request',
    })
    expect(res.status).toBe(204)
    expect(process).toHaveBeenCalledWith('pull_request', prPayload)
  })

  test('204 for pull_request_review and delegates to processor', async () => {
    verify.mockReturnValue(true)
    const res = await post(JSON.stringify(prPayload), {
      'X-GitHub-Event': 'pull_request_review',
    })
    expect(res.status).toBe(204)
    expect(process).toHaveBeenCalledWith('pull_request_review', prPayload)
  })

  test('204 for pull_request_review_comment and delegates to processor', async () => {
    verify.mockReturnValue(true)
    const res = await post(JSON.stringify(prPayload), {
      'X-GitHub-Event': 'pull_request_review_comment',
    })
    expect(res.status).toBe(204)
    expect(process).toHaveBeenCalledWith(
      'pull_request_review_comment',
      prPayload,
    )
  })

  test('204 for unsupported event still delegates to processor (service no-op)', async () => {
    verify.mockReturnValue(true)
    const res = await post('{}', { 'X-GitHub-Event': 'issues' })
    expect(res.status).toBe(204)
    expect(process).toHaveBeenCalledWith('issues', {})
  })
})
