import type { ShapedGitHubPullRequest } from '../model'
import type { createStore } from '../store'

const releasedPullRequests = (allPullRequests: ShapedGitHubPullRequest[]) =>
  allPullRequests.filter((pr) => pr.state === 'closed' && pr.targetBranch === 'production')

export const findReleaseDate = async (
  allPullRequests: ShapedGitHubPullRequest[],
  store: ReturnType<typeof createStore>,
  targetHash: string
) => {
  for (const m of releasedPullRequests(allPullRequests)) {
    if ((await store.loader.commits(m.number)).some((c) => c.sha === targetHash)) {
      return m.mergedAt
    }
  }
  return null
}
