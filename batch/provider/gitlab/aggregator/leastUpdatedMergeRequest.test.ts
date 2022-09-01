import { describe, expect, test } from 'vitest'
import type { GitLabMergeRequest, GitLabMilestone } from '../model'
import { leastUpdatedMergeRequest } from './leastUpdatedMergeRequest'

describe('leastCreatedMergeRequest', () => {
  const prototype: GitLabMergeRequest = {
    id: 0,
    iid: 0,
    project_id: 0,
    title: '',
    description: '',
    state: '',
    merged_by: { username: '' },
    merged_at: '',
    created_at: '',
    updated_at: '',
    target_branch: '',
    source_branch: '',
    upvotes: 0,
    downvotes: 0,
    author: { username: '' },
    assignee: { username: '' },
    source_project_id: 0,
    target_project_id: 0,
    work_in_progress: true,
    milestone: null as unknown as GitLabMilestone,
    merge_when_pipeline_succeeds: false,
    merge_status: '',
    sha: '',
    user_notes_count: 0,
    should_remove_source_branch: false,
    force_remove_source_branch: false,
    web_url: '',
    references: { short: '', relative: '', full: '' },
    time_stats: { time_estimate: 0, total_time_spent: 0, human_time_estimate: '', human_total_time_spent: '' },
    squash: false,
    task_completion_status: { completed_count: 0, count: 0 },
    has_conflicts: false,
    blocking_discussions_resolved: false
  }

  test('shold retun a least updated_at object', () => {
    const ret = leastUpdatedMergeRequest([
      { ...prototype, id: 1, updated_at: '2022-01-01T00:00:0.0Z' },
      { ...prototype, id: 2, updated_at: '2022-01-02T00:00:0.0Z' },
      { ...prototype, id: 3, updated_at: '2022-01-01T00:00:0.0Z' }
    ])
    expect(ret?.id).toEqual(2) // 最新のもの１件
  })

  test('shold retuns null when empty array specified', () => {
    const subject: GitLabMergeRequest[] = []
    const ret = leastUpdatedMergeRequest(subject)
    expect(ret).toBeNull()
  })
})
