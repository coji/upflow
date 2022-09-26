import type { ShapedGitHubPullRequest } from '../model'
import type { createStore } from '../store'

const releasedPullRequests = (allPullRequests: ShapedGitHubPullRequest[], method: string, key: string) => {
  return allPullRequests.filter((pr) => pr.targetBranch.match(key) && pr.state === 'closed' && pr.mergedAt !== null)
}

export const findReleaseDate = async (
  allPullRequests: ShapedGitHubPullRequest[],
  store: ReturnType<typeof createStore>,
  targetHash: string,
  method: string,
  key: string
) => {
  for (const m of releasedPullRequests(allPullRequests, method, key)) {
    if ((await store.loader.commits(m.number)).some((c) => c.sha === targetHash)) {
      return m.mergedAt
    }
  }
  return null
}
