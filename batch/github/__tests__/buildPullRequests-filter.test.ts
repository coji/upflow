import { describe, expect, test } from 'vitest'
import type { OrganizationId } from '~/app/types/organization'
import type {
  ShapedGitHubCommit,
  ShapedGitHubPullRequest,
  ShapedGitHubReview,
  ShapedGitHubReviewComment,
  ShapedTimelineItem,
} from '../model'
import { buildPullRequests } from '../pullrequest'
import type { PullRequestLoaders } from '../types'

// --- テストデータ ---

const basePr: ShapedGitHubPullRequest = {
  id: 0,
  organization: 'test-org',
  repo: 'test-repo',
  number: 0,
  state: 'closed',
  title: '',
  body: null,
  url: 'https://github.com/test-org/test-repo/pull/0',
  author: 'author1',
  authorIsBot: false,
  assignees: [],
  reviewers: [],
  draft: false,
  sourceBranch: 'feature',
  targetBranch: 'main',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-02T00:00:00Z',
  mergedAt: '2024-01-02T00:00:00Z',
  closedAt: '2024-01-02T00:00:00Z',
  mergeCommitSha: 'abc123',
  additions: 10,
  deletions: 5,
  changedFiles: 2,
  files: [],
}

// テストデータ: PR#1,#2 は develop にマージ → PR#4 で develop → main にリリース
// これにより推移的リリース検出（PR#2 → develop → main）がテストされる
const prs: ShapedGitHubPullRequest[] = [
  {
    ...basePr,
    id: 1,
    number: 1,
    title: 'PR 1 - merged to develop',
    sourceBranch: 'feature/a',
    targetBranch: 'develop',
    mergeCommitSha: 'sha1',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-03T00:00:00Z',
    mergedAt: '2024-01-02T00:00:00Z',
    closedAt: '2024-01-02T00:00:00Z',
    reviewers: [{ login: 'reviewer1', requestedAt: '2024-01-01T01:00:00Z' }],
  },
  {
    ...basePr,
    id: 2,
    number: 2,
    title: 'PR 2 - merged to develop (released via PR 4)',
    sourceBranch: 'feature/b',
    targetBranch: 'develop',
    mergeCommitSha: 'sha2',
    createdAt: '2024-01-05T00:00:00Z',
    updatedAt: '2024-01-08T00:00:00Z',
    mergedAt: '2024-01-07T00:00:00Z',
    closedAt: '2024-01-07T00:00:00Z',
  },
  {
    ...basePr,
    id: 3,
    number: 3,
    title: 'PR 3 - open',
    sourceBranch: 'feature/c',
    targetBranch: 'develop',
    state: 'open',
    mergeCommitSha: null,
    createdAt: '2024-01-10T00:00:00Z',
    updatedAt: '2024-01-11T00:00:00Z',
    mergedAt: null,
    closedAt: null,
  },
  {
    ...basePr,
    id: 4,
    number: 4,
    title: 'PR 4 - release (develop → main)',
    sourceBranch: 'develop',
    targetBranch: 'main',
    mergeCommitSha: 'sha_release',
    createdAt: '2024-01-06T00:00:00Z',
    updatedAt: '2024-01-08T00:00:00Z',
    mergedAt: '2024-01-08T00:00:00Z',
    closedAt: '2024-01-08T00:00:00Z',
  },
]

const commitsMap: Record<number, ShapedGitHubCommit[]> = {
  1: [
    {
      sha: 'c1',
      url: '',
      committer: 'author1',
      date: '2023-12-31T00:00:00Z',
    },
  ],
  2: [
    {
      sha: 'c2',
      url: '',
      committer: 'author1',
      date: '2024-01-04T00:00:00Z',
    },
  ],
  3: [
    {
      sha: 'c3',
      url: '',
      committer: 'author1',
      date: '2024-01-09T00:00:00Z',
    },
  ],
  4: [
    {
      sha: 'c4',
      url: '',
      committer: 'author1',
      date: '2024-01-05T00:00:00Z',
    },
  ],
}

const reviewsMap: Record<number, ShapedGitHubReview[]> = {
  1: [
    {
      id: 101,
      user: 'reviewer1',
      isBot: false,
      state: 'APPROVED',
      url: '',
      submittedAt: '2024-01-01T12:00:00Z',
    },
  ],
  2: [
    {
      id: 102,
      user: 'reviewer2',
      isBot: false,
      state: 'CHANGES_REQUESTED',
      url: '',
      submittedAt: '2024-01-06T00:00:00Z',
    },
  ],
  3: [],
  4: [],
}

const discussionsMap: Record<number, ShapedGitHubReviewComment[]> = {
  1: [
    {
      id: 201,
      user: 'reviewer1',
      isBot: false,
      url: '',
      createdAt: '2024-01-01T10:00:00Z',
    },
  ],
  2: [
    {
      id: 202,
      user: 'reviewer2',
      isBot: false,
      url: '',
      createdAt: '2024-01-06T00:00:00Z',
    },
  ],
  3: [],
  4: [],
}

const timelineItemsMap: Record<number, ShapedTimelineItem[]> = {
  1: [
    {
      type: 'review_requested',
      createdAt: '2024-01-01T01:00:00Z',
      reviewer: 'reviewer1',
    },
  ],
  2: [],
  3: [],
  4: [],
}

const mockLoaders: PullRequestLoaders = {
  commits: async (n) => commitsMap[n] ?? [],
  reviews: async (n) => reviewsMap[n] ?? [],
  discussions: async (n) => discussionsMap[n] ?? [],
  tags: async () => [],
  timelineItems: async (n) => timelineItemsMap[n] ?? [],
}

const config = {
  organizationId: 'org-1' as OrganizationId,
  repositoryId: 'repo-1',
  releaseDetectionMethod: 'branch',
  releaseDetectionKey: 'main',
  botLogins: new Set<string>(),
}

// --- テスト ---

describe('buildPullRequests filter', () => {
  test('フィルタなし vs 全PR番号指定 → 結果が一致する', async () => {
    const allNumbers = new Set(prs.map((p) => p.number))

    const resultAll = await buildPullRequests(config, prs, mockLoaders)
    const resultFiltered = await buildPullRequests(
      config,
      prs,
      mockLoaders,
      allNumbers,
    )

    expect(resultFiltered.pulls).toEqual(resultAll.pulls)
    expect(resultFiltered.reviews).toEqual(resultAll.reviews)
    expect(resultFiltered.reviewers).toEqual(resultAll.reviewers)
  })

  test('サブセットフィルタ → 対象PRの結果が全件処理時と一致する', async () => {
    const subset = new Set([1, 3])

    const resultAll = await buildPullRequests(config, prs, mockLoaders)
    const resultSubset = await buildPullRequests(
      config,
      prs,
      mockLoaders,
      subset,
    )

    // pulls: サブセット結果と、全件結果から同じPR番号を抽出したものが一致
    const expectedPulls = resultAll.pulls.filter((p) => subset.has(p.number))
    expect(resultSubset.pulls).toEqual(expectedPulls)

    // reviews
    const expectedReviews = resultAll.reviews.filter((r) =>
      subset.has(r.pullRequestNumber),
    )
    expect(resultSubset.reviews).toEqual(expectedReviews)

    // reviewers
    const expectedReviewers = resultAll.reviewers.filter((r) =>
      subset.has(r.pullRequestNumber),
    )
    expect(resultSubset.reviewers).toEqual(expectedReviewers)
  })

  test('空フィルタ → 結果が空になる', async () => {
    const empty = new Set<number>()

    const result = await buildPullRequests(config, prs, mockLoaders, empty)

    expect(result.pulls).toEqual([])
    expect(result.reviews).toEqual([])
    expect(result.reviewers).toEqual([])
  })

  test('リリース検出はフィルタに関係なく全PRから行われる', async () => {
    // PR 2 (feature/b → develop) は PR 4 (develop → main) 経由で推移的にリリース検出される
    // フィルタで PR 2 だけ指定しても、PR 4 がルックアップ構築に含まれリリース日が正しく設定される
    const filterJustPr2 = new Set([2])

    const resultAll = await buildPullRequests(config, prs, mockLoaders)
    const resultFiltered = await buildPullRequests(
      config,
      prs,
      mockLoaders,
      filterJustPr2,
    )

    const pr2All = resultAll.pulls.find((p) => p.number === 2)
    const pr2Filtered = resultFiltered.pulls.find((p) => p.number === 2)

    // 推移的リリース検出が実際に動作していることを確認
    expect(pr2All?.releasedAt).toBe('2024-01-08T00:00:00Z')
    expect(pr2Filtered).toEqual(pr2All)
  })

  test('reviewer が 0 人の PR でも reviewers エントリが生成される', async () => {
    // PR#3 は reviewers: [] (basePr デフォルト)
    const result = await buildPullRequests(config, prs, mockLoaders)

    // reviewer が 0 人でも reviewers 配列に PR のエントリがある
    // → batchReplacePullRequestReviewers で古い reviewer レコードが DELETE される
    const pr3Reviewers = result.reviewers.find((r) => r.pullRequestNumber === 3)
    expect(pr3Reviewers).toBeDefined()
    expect(pr3Reviewers?.reviewers).toEqual([])
  })
})
