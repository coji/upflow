import { RouterContextProvider } from 'react-router'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { orgContext } from '~/app/middleware/context'
import { toOrgId } from '~/app/types/organization'

const queries = vi.hoisted(() => ({
  getRepository: vi.fn(),
  getPullRequest: vi.fn(),
}))
const createFetcher = vi.hoisted(() => vi.fn())

vi.mock('./queries.server', () => ({
  ...queries,
  getPullRequestRawData: vi.fn(),
  getPullRequestReviewers: vi.fn(),
  getPullRequestReviews: vi.fn(),
}))
vi.mock('~/app/services/github-integration-queries.server', () => ({
  getIntegration: vi.fn().mockResolvedValue(null),
  getGithubAppLinks: vi.fn().mockResolvedValue([]),
}))
vi.mock('~/app/services/github-octokit.server', () => ({
  resolveOctokitForRepository: vi.fn().mockReturnValue({}),
}))
vi.mock('~/batch/github/fetcher', () => ({ createFetcher }))
vi.mock('~/batch/github/store', () => ({ createStore: vi.fn() }))

const { action } = await import('./index')

const callAction = (intent: string) => {
  const context = new RouterContextProvider()
  context.set(orgContext, {
    user: {} as never,
    organization: { id: toOrgId('org-1'), name: 'Org', slug: 'org' },
    membership: { id: 'm-1', role: 'admin' },
  })
  const body = new FormData()
  body.set('intent', intent)
  return action({
    request: new Request('http://localhost/x', { method: 'POST', body }),
    params: { orgSlug: 'org', repository: 'repo-1', pull: '42' },
    context,
  } as never)
}

describe('PR detail action', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    queries.getRepository.mockResolvedValue({
      id: 'repo-1',
      owner: 'acme',
      repo: 'widget',
    })
  })

  test.each(['compare', 'refresh'])(
    '%s returns 404 for a PR the org has not crawled',
    async (intent) => {
      queries.getPullRequest.mockResolvedValue(undefined)

      const thrown = await callAction(intent).catch((e: unknown) => e)
      expect(thrown).toBeInstanceOf(Response)
      expect((thrown as Response).status).toBe(404)
      expect(createFetcher).not.toHaveBeenCalled()
    },
  )

  test('compare fetches from GitHub for a known PR', async () => {
    queries.getPullRequest.mockResolvedValue({ number: 42 })
    const fetcher = {
      commits: vi.fn().mockResolvedValue([]),
      comments: vi.fn().mockResolvedValue([]),
      reviews: vi.fn().mockResolvedValue([]),
      timelineItems: vi.fn().mockResolvedValue([]),
    }
    createFetcher.mockReturnValue(fetcher)

    const result = await callAction('compare')
    expect(result).toMatchObject({ intent: 'compare' })
    expect(fetcher.commits).toHaveBeenCalledWith(42)
  })
})
