import * as R from 'remeda'
import type { ShapedGitLabMergeRequest } from '../model'
import type { createStore } from '../store'

const releasedMergeRequests = (allMergeRequests: ShapedGitLabMergeRequest[], key: string) => {
  return R.pipe(
    allMergeRequests,
    R.filter((mr) => mr.targetBranch === key && mr.state === 'merged' && mr.mergedAt !== null),
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    R.sortBy((mr) => mr.mergedAt!),
  )
}

export const findReleaseDate = async (
  allMergeRequests: ShapedGitLabMergeRequest[],
  store: ReturnType<typeof createStore>,
  mr: ShapedGitLabMergeRequest,
  key: string,
) => {
  for (const m of releasedMergeRequests(allMergeRequests, key)) {
    if ((await store.loader.commits(m.iid)).some((c) => c.sha === mr.mergeCommitSha)) {
      return m.mergedAt
    }
  }
  return null
}
