import { beforeEach, describe, expect, test, vi } from 'vitest'
import { getSession } from '~/app/libs/auth.server'
import {
  claimInstallStateForUser,
  getInstallStateTarget,
  InstallStateError,
} from '~/app/libs/github-app-state.server'
import { getGithubAppSlug } from '~/app/services/github-octokit.server'
import { action, loader } from './api.github.install'

vi.mock('~/app/libs/auth.server', () => ({ getSession: vi.fn() }))
vi.mock('~/app/libs/github-app-state.server', async (importOriginal) => ({
  ...(await importOriginal()),
  claimInstallStateForUser: vi.fn(),
  getInstallStateTarget: vi.fn(),
}))
vi.mock('~/app/services/github-octokit.server', () => ({
  getGithubAppSlug: vi.fn(),
}))

const mockSession = vi.mocked(getSession)
const mockClaim = vi.mocked(claimInstallStateForUser)
const mockTarget = vi.mocked(getInstallStateTarget)
const mockSlug = vi.mocked(getGithubAppSlug)

describe('api.github.install', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSession.mockResolvedValue({ user: { id: 'delegate' } } as never)
    mockTarget.mockResolvedValue({
      organizationName: 'Acme',
      organizationSlug: 'acme',
    })
    mockSlug.mockResolvedValue('upflow-team')
  })

  test('sends an unauthenticated recipient through login with the state intact', async () => {
    mockSession.mockResolvedValue(null)
    await expect(
      loader({
        request: new Request('http://x/api/github/install?state=secret'),
      } as never),
    ).rejects.toMatchObject({ status: 302 })
  })

  test('claims the bearer state for the signed-in recipient before GitHub', async () => {
    const body = new FormData()
    body.set('state', 'secret')
    await expect(
      action({
        request: new Request('http://x/api/github/install', {
          method: 'POST',
          body,
        }),
      } as never),
    ).rejects.toMatchObject({ status: 302 })
    expect(mockClaim).toHaveBeenCalledWith('secret', 'delegate')
  })

  test('does not continue when the state belongs to another recipient', async () => {
    mockClaim.mockRejectedValue(new InstallStateError('already claimed'))
    const body = new FormData()
    body.set('state', 'secret')
    const response = await action({
      request: new Request('http://x/api/github/install', {
        method: 'POST',
        body,
      }),
    } as never).catch((error) => error as Response)
    expect(response.status).toBe(400)
  })
})
