import type { ShapedGitLabCommit } from '../model'
import { pipe, sortBy, first } from 'remeda'

export const firstCommit = (commits: ShapedGitLabCommit[]) =>
  pipe(
    commits,
    sortBy((x) => x.createdAt),
    first(),
  ) ?? null
