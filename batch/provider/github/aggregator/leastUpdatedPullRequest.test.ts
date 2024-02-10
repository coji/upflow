import { describe, expect, test } from 'vitest'
import type { ShapedGitHubPullRequest } from '../model'
import { leastUpdatedPullRequest } from './leastUpdatedPullRequest'

describe('leastCreatedMergeRequest', () => {
  const prototype: ShapedGitHubPullRequest = {
    repo: '',
    number: 0,
    state: '',
    title: '',
    created_at: '',
    updated_at: '',
    merged_at: '',
    merge_commit_sha: '',
    url: '',
    author: '',
    source_branch: '',
    target_branch: '',
    assignees: [],
    reviewers: [],
    draft: false,
    id: 0,
    organization: '',
  }

  test('should return a least updated_at object', () => {
    const ret = leastUpdatedPullRequest([
      { ...prototype, number: 1, updated_at: '2022-01-01T00:00:0.0Z' },
      { ...prototype, number: 2, updated_at: '2022-01-02T00:00:0.0Z' },
      { ...prototype, number: 3, updated_at: '2022-01-01T00:00:0.0Z' },
    ])
    expect(ret?.number).toEqual(2) // 最新のもの１件
  })

  test('should returns null when empty array specified', () => {
    const subject: ShapedGitHubPullRequest[] = []
    const ret = leastUpdatedPullRequest(subject)
    expect(ret).toBeNull()
  })
})
