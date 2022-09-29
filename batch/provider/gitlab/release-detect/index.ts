import type { ShapedGitLabMergeRequest } from '../model'
import type { createStore } from '../store'

const releasedMergeRequests = (allMergeRequests: ShapedGitLabMergeRequest[], method: string, key: string) => {
  if (method === 'branch') {
    return allMergeRequests.filter((mr) => {
      if (mr.targetBranch === key && mr.state === 'merged') {
        console.log('release: ', mr.iid, mr.targetBranch, mr.mergedAt, mr.title)
      }
      return mr.targetBranch === key && mr.state === 'merged'
    })
  } else {
    return []
  }
}

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
