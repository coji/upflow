import { describe, expect, test } from 'vitest'
import { leastUpdatedPullRequest } from './aggregator'
import type { ShapedGitHubPullRequest } from './model'

describe('leastCreatedMergeRequest', () => {
  const prototype: ShapedGitHubPullRequest = {
    repo: '',
    number: 0,
    state: 'open',
    title: '',
    body: null,
    createdAt: '',
    updatedAt: '',
    mergedAt: '',
    closedAt: null,
    mergeCommitSha: '',
    url: '',
    author: '',
    sourceBranch: '',
    targetBranch: '',
    assignees: [],
    reviewers: [],
    draft: false,
    id: 0,
    organization: '',
    additions: null,
    deletions: null,
    changedFiles: null,
    files: [],
  }

  test('should return a least updatedAt object', () => {
    const ret = leastUpdatedPullRequest([
      { ...prototype, number: 1, updatedAt: '2022-01-01T00:00:0.0Z' },
      { ...prototype, number: 2, updatedAt: '2022-01-02T00:00:0.0Z' },
      { ...prototype, number: 3, updatedAt: '2022-01-01T00:00:0.0Z' },
    ])
    expect(ret?.number).toEqual(2) // 最新のもの１件
  })

  test('should returns null when empty array specified', () => {
    const subject: ShapedGitHubPullRequest[] = []
    const ret = leastUpdatedPullRequest(subject)
    expect(ret).toBeNull()
  })
})
