import { beforeEach, describe, expect, test, vi } from 'vitest'
import { getSession } from '~/app/libs/auth.server'
import {
  consumeAuthorizedInstallStateDetailed,
  getAuthorizedInstallStateOrganization,
  InstallStateError,
  releaseConsumedInstallState,
} from '~/app/libs/github-app-state.server'
import {
  completeGithubAppSetup,
  GithubInstallationAlreadyLinkedError,
  GithubInstallationAuthorizationError,
  verifyGithubInstallation,
  verifyUserCanManageGithubInstallation,
} from '~/app/services/github-app-setup.server'
import { db } from '~/app/services/db.server'
import { loader } from './api.github.setup'

vi.mock('~/app/services/github-app-setup.server', () => ({
  completeGithubAppSetup: vi.fn(),
  verifyGithubInstallation: vi.fn(),
  verifyUserCanManageGithubInstallation: vi.fn(),
  GithubInstallationAlreadyLinkedError: class extends Error {},
  GithubInstallationAuthorizationError: class extends Error {},
}))

vi.mock('~/app/libs/github-app-state.server', () => {
  class MockInstallStateError extends Error {
    override name = 'InstallStateError'
  }
  return {
    consumeAuthorizedInstallStateDetailed: vi.fn(),
    getAuthorizedInstallStateOrganization: vi.fn(),
    releaseConsumedInstallState: vi.fn(),
    InstallStateError: MockInstallStateError,
  }
})

vi.mock('~/app/libs/auth.server', () => ({
  getSession: vi.fn(),
}))

vi.mock('~/app/services/db.server', () => {
  const executeTakeFirst = vi.fn()
  const chain = {
    innerJoin: vi.fn(),
    select: vi.fn(),
    where: vi.fn(),
    executeTakeFirst,
  }
  chain.innerJoin.mockReturnValue(chain)
  chain.select.mockReturnValue(chain)
  chain.where.mockReturnValue(chain)
  return {
    db: {
      selectFrom: vi.fn(() => chain),
    },
  }
})

const mockCompleteSetup = vi.mocked(completeGithubAppSetup)
const mockVerifyInstallation = vi.mocked(verifyGithubInstallation)
const mockVerifyUserCanManage = vi.mocked(verifyUserCanManageGithubInstallation)
const mockConsume = vi.mocked(consumeAuthorizedInstallStateDetailed)
const mockGetStateOrganization = vi.mocked(
  getAuthorizedInstallStateOrganization,
)
const mockRelease = vi.mocked(releaseConsumedInstallState)
const mockGetSession = vi.mocked(getSession)
const mockExecuteTakeFirst = vi.mocked(
  db.selectFrom('organizations').select('id').executeTakeFirst,
)

function req(url: string) {
  return new Request(url)
}

describe('api.github.setup loader', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockVerifyInstallation.mockResolvedValue({
      id: 7,
      account: { id: 100, login: 'acme', type: 'Organization' },
      repositorySelection: 'all',
      suspendedAt: null,
    })
    mockCompleteSetup.mockResolvedValue()
    mockRelease.mockResolvedValue()
    mockVerifyUserCanManage.mockResolvedValue()
    mockConsume.mockResolvedValue({
      organizationId: 'o1' as never,
      stateId: 'state-1',
      intentKind: 'handoff',
    })
    mockGetStateOrganization.mockResolvedValue(null)
    mockGetSession.mockResolvedValue({ user: { id: 'u1' } } as never)
    mockExecuteTakeFirst.mockReset().mockResolvedValue(undefined)
  })

  test('400 when installation_id missing', async () => {
    const res = (await loader({
      request: req('http://x/api/github/setup?state=n'),
    } as never)) as Response
    expect(res.status).toBe(400)
    expect(mockConsume).not.toHaveBeenCalled()
  })

  test('updates an already linked installation even when GitHub returns stale state', async () => {
    mockExecuteTakeFirst
      .mockResolvedValueOnce({ organizationId: 'o1', slug: 'acme' } as never)
      .mockResolvedValueOnce({ id: 'm1' } as never)
      .mockResolvedValueOnce({ id: 'm1' } as never)

    await expect(
      loader({
        request: req(
          'http://x/api/github/setup?installation_id=1&state=stale-state',
        ),
      } as never),
    ).rejects.toBeInstanceOf(Response)

    expect(mockConsume).not.toHaveBeenCalled()
    expect(mockCompleteSetup).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'installation_update_callback' }),
    )
  })

  test('does not consume another pending intent during an existing-link update', async () => {
    mockExecuteTakeFirst
      .mockResolvedValueOnce({ organizationId: 'o1', slug: 'acme' } as never)
      .mockResolvedValueOnce({ id: 'm1' } as never)
    await expect(
      loader({
        request: req('http://x/api/github/setup?installation_id=1'),
      } as never),
    ).rejects.toMatchObject({ status: 302 })
    expect(mockConsume).not.toHaveBeenCalled()
    expect(mockCompleteSetup).toHaveBeenCalled()
  })

  test('consumes a matching live state used by an existing-link update', async () => {
    mockExecuteTakeFirst
      .mockResolvedValueOnce({ organizationId: 'o1', slug: 'acme' } as never)
      .mockResolvedValueOnce({ id: 'm1' } as never)
    mockGetStateOrganization.mockResolvedValue('o1' as never)

    await expect(
      loader({
        request: req(
          'http://x/api/github/setup?installation_id=1&state=live-state',
        ),
      } as never),
    ).rejects.toMatchObject({ status: 302 })

    expect(mockConsume).toHaveBeenCalledWith({
      installationId: 1,
      nonce: 'live-state',
      userId: 'u1',
    })
  })

  test('keeps an authorized existing-link update when its state loses a consume race', async () => {
    mockExecuteTakeFirst
      .mockResolvedValueOnce({ organizationId: 'o1', slug: 'acme' } as never)
      .mockResolvedValueOnce({ id: 'm1' } as never)
    mockGetStateOrganization.mockResolvedValue('o1' as never)
    mockConsume.mockRejectedValue(new InstallStateError('already used'))

    await expect(
      loader({
        request: req(
          'http://x/api/github/setup?installation_id=1&state=raced-state',
        ),
      } as never),
    ).rejects.toMatchObject({ status: 302 })

    expect(mockCompleteSetup).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'installation_update_callback' }),
    )
  })

  test('does not apply another organizations live state to an existing link', async () => {
    mockExecuteTakeFirst.mockResolvedValueOnce({
      organizationId: 'existing-org',
      slug: 'existing',
    } as never)
    mockGetStateOrganization.mockResolvedValue('intended-org' as never)

    const response = (await loader({
      request: req(
        'http://x/api/github/setup?installation_id=1&state=other-org-state',
      ),
    } as never)) as Response

    expect(response.status).toBe(409)
    expect(mockVerifyInstallation).not.toHaveBeenCalled()
    expect(mockCompleteSetup).not.toHaveBeenCalled()
  })

  test('recovers an unlinked existing installation from one pending organization', async () => {
    mockExecuteTakeFirst
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ id: 'o1', slug: 'acme' } as never)
      .mockResolvedValueOnce({ id: 'm1' } as never)
    mockConsume.mockResolvedValue({
      organizationId: 'o1' as never,
      stateId: 'state-1',
      intentKind: 'direct',
    })

    await expect(
      loader({
        request: req('http://x/api/github/setup?installation_id=1'),
      } as never),
    ).rejects.toBeInstanceOf(Response)

    expect(mockConsume).toHaveBeenCalledWith({
      installationId: 1,
      nonce: null,
      userId: 'u1',
    })
    expect(mockVerifyUserCanManage).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ id: 7 }),
    )
    expect(mockCompleteSetup).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'existing_installation_link' }),
    )
  })

  test('403 when neither an Upflow owner nor GitHub owner updates a link', async () => {
    mockExecuteTakeFirst
      .mockResolvedValueOnce({ organizationId: 'o1', slug: 'acme' } as never)
      .mockResolvedValueOnce(undefined)
    mockVerifyUserCanManage.mockRejectedValue(
      new GithubInstallationAuthorizationError('not owner'),
    )

    const res = (await loader({
      request: req('http://x/api/github/setup?installation_id=1'),
    } as never)) as Response

    expect(res.status).toBe(403)
    expect(mockVerifyInstallation).toHaveBeenCalled()
    expect(mockCompleteSetup).not.toHaveBeenCalled()
  })

  test('400 when installation_id is not an integer', async () => {
    const res = (await loader({
      request: req('http://x/api/github/setup?installation_id=abc&state=nonce'),
    } as never)) as Response
    expect(res.status).toBe(400)
  })

  test('502 when GitHub API fails', async () => {
    mockVerifyInstallation.mockRejectedValue(new Error('network'))

    const res = (await loader({
      request: req('http://x/api/github/setup?installation_id=1&state=nonce'),
    } as never)) as Response

    expect(res.status).toBe(502)
    expect(mockConsume).not.toHaveBeenCalled()
    expect(mockRelease).not.toHaveBeenCalled()
  })

  test('delegated state callback preserves its URL through login', async () => {
    mockGetSession.mockResolvedValue(null)

    await expect(
      loader({
        request: req('http://x/api/github/setup?installation_id=1&state=nonce'),
      } as never),
    ).rejects.toBeInstanceOf(Response)

    expect(mockVerifyInstallation).not.toHaveBeenCalled()
    expect(mockConsume).not.toHaveBeenCalled()
    expect(mockCompleteSetup).not.toHaveBeenCalled()
  })

  test('400 when consumeInstallState rejects', async () => {
    mockConsume.mockRejectedValue(new InstallStateError('used'))

    const res = (await loader({
      request: req('http://x/api/github/setup?installation_id=1&state=bad'),
    } as never)) as Response

    expect(res.status).toBe(400)
  })

  test('409 when another organization links the installation concurrently', async () => {
    mockExecuteTakeFirst.mockResolvedValueOnce(undefined)
    mockCompleteSetup.mockRejectedValue(
      new GithubInstallationAlreadyLinkedError('already linked'),
    )

    const res = (await loader({
      request: req('http://x/api/github/setup?installation_id=1&state=nonce'),
    } as never)) as Response

    expect(res.status).toBe(409)
    expect(mockRelease).toHaveBeenCalledWith('state-1')
  })

  test('releases the consumed state when saving fails transiently', async () => {
    mockExecuteTakeFirst.mockResolvedValueOnce(undefined)
    mockCompleteSetup.mockRejectedValue(new Error('database busy'))

    const res = (await loader({
      request: req('http://x/api/github/setup?installation_id=1&state=nonce'),
    } as never)) as Response

    expect(res.status).toBe(500)
    expect(mockRelease).toHaveBeenCalledWith('state-1')
  })

  test('403 when GitHub cannot prove organization ownership', async () => {
    mockExecuteTakeFirst.mockResolvedValueOnce(undefined)
    mockVerifyUserCanManage.mockRejectedValue(
      new GithubInstallationAuthorizationError('sign in again'),
    )

    const res = (await loader({
      request: req('http://x/api/github/setup?installation_id=1'),
    } as never)) as Response

    expect(res.status).toBe(403)
    expect(await res.text()).toBe(
      'This GitHub installation cannot be connected.',
    )
    expect(mockConsume).toHaveBeenCalled()
    expect(mockRelease).toHaveBeenCalledWith('state-1')
    expect(mockCompleteSetup).not.toHaveBeenCalled()
  })

  test('shows actionable GitHub approval guidance for a state callback', async () => {
    mockVerifyUserCanManage.mockRejectedValue(
      new GithubInstallationAuthorizationError('approve Members permission'),
    )

    const res = (await loader({
      request: req('http://x/api/github/setup?installation_id=1&state=handoff'),
    } as never)) as Response

    expect(res.status).toBe(403)
    expect(await res.text()).toBe('approve Members permission')
  })
})
