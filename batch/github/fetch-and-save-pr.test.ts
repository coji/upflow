import { describe, expect, test } from 'vitest'
import {
  fetchAndSavePr,
  type PrFetcher,
  type PrStore,
} from './fetch-and-save-pr'
import type { ShapedGitHubPullRequest } from './model'

const pr: ShapedGitHubPullRequest = {
  id: 7,
  organization: 'test-owner',
  repo: 'test-repo',
  number: 7,
  state: 'open',
  title: 'PR #7',
  body: null,
  url: 'https://github.com/test-owner/test-repo/pull/7',
  author: 'user1',
  authorIsBot: false,
  assignees: [],
  reviewers: [],
  draft: false,
  sourceBranch: 'feature',
  targetBranch: 'main',
  createdAt: '2026-11-01T00:00:00Z',
  updatedAt: '2026-11-02T00:00:00Z',
  mergedAt: null,
  closedAt: null,
  mergeCommitSha: null,
  additions: 1,
  deletions: 0,
  changedFiles: 1,
  files: [],
}
const files = [{ path: 'a.ts', additions: 1, deletions: 0 }]
const rowFetchedAt = '2026-11-28T00:00:00.000Z'

const makeFakes = (saveResult: boolean) => {
  const calls: string[] = []
  const saved: Parameters<PrStore['savePrData']>[] = []
  const fetcher: PrFetcher = {
    pullrequest: async () => (calls.push('pullrequest'), pr),
    commits: async () => (calls.push('commits'), []),
    comments: async () => (calls.push('comments'), []),
    reviews: async () => (calls.push('reviews'), []),
    timelineItems: async () => (calls.push('timelineItems'), []),
    files: async () => (calls.push('files'), files),
  }
  const store: PrStore = {
    getFetchedAt: async (n) => (calls.push(`getFetchedAt:${n}`), rowFetchedAt),
    savePrData: async (...args) => {
      calls.push('savePrData')
      saved.push(args)
      return saveResult
    },
  }
  return { calls, saved, fetcher, store }
}

describe('fetchAndSavePr', () => {
  test('reads the row fetchedAt before any GitHub read, and saves over it', async () => {
    const { calls, saved, fetcher, store } = makeFakes(true)
    expect(await fetchAndSavePr(fetcher, store, 7)).toBe(true)
    expect(calls[0]).toBe('getFetchedAt:7')
    expect(calls.at(-1)).toBe('savePrData')
    expect(saved[0][0]).toEqual({ ...pr, files })
    expect(saved[0][2]).toBe(rowFetchedAt)
  })

  test('returns false when the save is refused', async () => {
    const { fetcher, store } = makeFakes(false)
    expect(await fetchAndSavePr(fetcher, store, 7)).toBe(false)
  })
})
