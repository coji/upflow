export interface DB {
  pull_requests: {
    id: number
    organization: string
    repo: string
    number: number
    state: string
    title: string
    url: string
    author: string | null
    assignees: string[]
    reviewers: string[]
    draft: boolean
    source_branch: string
    target_branch: string
    created_at: string
    updated_at: string
    merged_at: string | null
    merge_commit_sha: string | null
  }
}
