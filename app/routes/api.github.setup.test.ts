import { beforeEach, describe, expect, test, vi } from 'vitest'
import { getSession } from '~/app/libs/auth.server'
import {
  consumeInstallState,
  InstallStateError,
} from '~/app/libs/github-app-state.server'
import { createAppOctokit } from '~/app/services/github-octokit.server'
import { loader } from './api.github.setup'

vi.mock('~/app/services/github-octokit.server', () => ({
  createAppOctokit: vi.fn(),
}))

vi.mock('~/app/libs/github-app-state.server', () => ({
  consumeInstallState: vi.fn(),
  InstallStateError: class InstallStateError extends Error {
    override name = 'InstallStateError'
  },
}))

vi.mock('~/app/libs/auth.server', () => ({
  getSession: vi.fn(),
}))

const mockCreateAppOctokit = vi.mocked(createAppOctokit)
const mockConsume = vi.mocked(consumeInstallState)
const mockGetSession = vi.mocked(getSession)

function req(url: string) {
  return new Request(url)
}

describe('api.github.setup loader', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCreateAppOctokit.mockReturnValue({
      rest: {
        apps: {
          getInstallation: vi.fn().mockResolvedValue({
            data: {
              id: 7,
              account: { id: 100, login: 'acme', type: 'Organization' },
              repository_selection: 'all',
            },
          }),
        },
      },
    } as never)
    mockConsume.mockResolvedValue({ organizationId: 'o1' as never })
    mockGetSession.mockResolvedValue(null)
  })

  test('400 when installation_id missing', async () => {
    const res = (await loader({
      request: req('http://x/api/github/setup?state=n'),
    } as never)) as Response
    expect(res.status).toBe(400)
    expect(mockConsume).not.toHaveBeenCalled()
  })

  test('400 when state missing', async () => {
    const res = (await loader({
      request: req('http://x/api/github/setup?installation_id=1'),
    } as never)) as Response
    expect(res.status).toBe(400)
  })

  test('400 when installation_id is not an integer', async () => {
    const res = (await loader({
      request: req('http://x/api/github/setup?installation_id=abc&state=nonce'),
    } as never)) as Response
    expect(res.status).toBe(400)
  })

  test('502 when GitHub API fails', async () => {
    mockCreateAppOctokit.mockReturnValue({
      rest: {
        apps: {
          getInstallation: vi.fn().mockRejectedValue(new Error('network')),
        },
      },
    } as never)

    const res = (await loader({
      request: req('http://x/api/github/setup?installation_id=1&state=nonce'),
    } as never)) as Response

    expect(res.status).toBe(502)
    expect(mockConsume).not.toHaveBeenCalled()
  })

  test('400 when consumeInstallState rejects', async () => {
    mockConsume.mockRejectedValue(new InstallStateError('used'))

    const res = (await loader({
      request: req('http://x/api/github/setup?installation_id=1&state=bad'),
    } as never)) as Response

    expect(res.status).toBe(400)
  })
})
