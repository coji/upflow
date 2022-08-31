import type { Types } from '@gitbeaker/node'
import { pipe, sortBy, first } from 'remeda'

export const firstCommit = (commits: Types.CommitSchema[]) =>
  pipe(
    commits,
    sortBy((x) => x.created_at),
    first()
  ) ?? null
