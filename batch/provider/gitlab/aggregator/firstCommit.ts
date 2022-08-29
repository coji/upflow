import type { Types } from '@gitbeaker/node'

export const firstCommit = (commits: Types.CommitSchema[]) =>
  commits.length
    ? commits.reduce((a, b) => (a.created_at < b.created_at ? a : b)) // 一番過去のもの1件を抽出
    : null
