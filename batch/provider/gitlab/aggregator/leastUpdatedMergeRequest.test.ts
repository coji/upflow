import { describe, expect, test } from 'vitest'
import type { ShapedGitLabMergeRequest } from '../model'
import { leastUpdatedMergeRequest } from './leastUpdatedMergeRequest'

describe('leastCreatedMergeRequest', () => {
  const prototype: ShapedGitLabMergeRequest = {
    iid: 0,
    projectId: 0,
    title: '',
    state: '',
    mergedAt: '',
    createdAt: '',
    updatedAt: '',
    sourceBranch: '',
    targetBranch: '',
    author: '',
    url: '',
    mergeCommitSha: ''
  }

  test('should returns a least updated_at object', () => {
    const ret = leastUpdatedMergeRequest([
      { ...prototype, iid: 1, updatedAt: '2022-01-01T00:00:0.0Z' },
      { ...prototype, iid: 2, updatedAt: '2022-01-02T00:00:0.0Z' },
      { ...prototype, iid: 3, updatedAt: '2022-01-01T00:00:0.0Z' }
    ])
    expect(ret?.iid).toEqual(2) // 最新のもの１件
  })

  test('should returns null when empty array specified', () => {
    const subject: ShapedGitLabMergeRequest[] = []
    const ret = leastUpdatedMergeRequest(subject)
    expect(ret).toBeNull()
  })
})
