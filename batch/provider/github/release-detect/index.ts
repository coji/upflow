import type { ShapedGitHubPullRequest } from '../model'
import type { createStore } from '../store'
import * as R from 'remeda'

const releasedPullRequests = (allPullRequests: ShapedGitHubPullRequest[], key: string) => {
  return R.pipe(
    allPullRequests,
    R.filter((pr) => pr.targetBranch === key && pr.state === 'closed' && pr.mergedAt !== null),
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    R.sortBy((pr) => pr.mergedAt!),
  )
}

export const findReleaseDate = async (
  allPullRequests: ShapedGitHubPullRequest[],
  store: ReturnType<typeof createStore>,
  pr: ShapedGitHubPullRequest,
  key: string,
) => {
  for (const m of releasedPullRequests(allPullRequests, key)) {
    if ((await store.loader.commits(m.number)).some((c) => c.sha === pr.mergeCommitSha)) {
      return m.mergedAt
    }
  }
  return null
}
