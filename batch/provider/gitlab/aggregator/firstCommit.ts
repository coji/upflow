import { first, pipe, sortBy } from 'remeda'
import type { ShapedGitLabCommit } from '../model'

export const firstCommit = (commits: ShapedGitLabCommit[]) =>
  pipe(
    commits,
    sortBy((x) => x.createdAt),
    first(),
  ) ?? null
