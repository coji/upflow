import {
  ColumnType,
  Generated,
  Insertable,
  JSONColumnType,
  Selectable,
  Updateable,
} from 'kysely'

export interface DB {
  pull_requests: {
    organization: string
    repo: string
    number: number
    state: string
    title: string
    url: string
    author: string | null
    source_branch: string
    target_branch: string
    created_at: string
    updated_at: string
    merged_at: string | null
    merge_commit_sha: string | null
  }
}
