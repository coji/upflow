import type { GitLabCommit } from '../model'
import { pipe, sortBy, first } from 'remeda'

export const firstCommit = (commits: GitLabCommit[]) =>
  pipe(
    commits,
    sortBy((x) => x.created_at),
    first()
  ) ?? null
