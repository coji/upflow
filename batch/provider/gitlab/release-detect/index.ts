import type { ShapedGitLabMergeRequest } from '../model'
import type { createStore } from '../store'

const releasedMergeRequests = (allMergeRequests: ShapedGitLabMergeRequest[], method: string, key: string) =>
  allMergeRequests.filter((mr) => mr.targetBranch.match(key) && mr.state === 'merged')

export const findReleaseDate = async (
  allMergeRequests: ShapedGitLabMergeRequest[],
  store: ReturnType<typeof createStore>,
  targetHash: string,
  method: string,
  key: string
) => {
  for (const m of releasedMergeRequests(allMergeRequests, method, key)) {
    if ((await store.loader.commits(m.iid)).some((c) => c.sha === targetHash)) {
      return m.mergedAt
    }
  }
  return null
}
