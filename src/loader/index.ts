import glob from 'glob-promise'
import { Types } from '@gitbeaker/node'
import { json, path } from '../helper/index'

export const createLoader = () => {
  const commits = async (mergerequestIid: number) =>
    json.load<Types.CommitSchema[]>(path.commitsJsonFilename(mergerequestIid))

  const discussions = async (mergerequestIid: number) =>
    json.load<Types.DiscussionSchema[]>(
      path.discussionsJsonFilename(mergerequestIid)
    )
  const mergerequests = async () =>
    json.load<Types.MergeRequestSchema[]>('mergerequests.json')

  const releasedCommits = async () => {
    const commits: Types.CommitSchema[] = []
    const matches = await glob(path.releaseCommitsGlob())
    for (const filename of matches) {
      const sha = path.sha(filename)
      commits.push(
        await json.load<Types.CommitSchema>(
          path.releaseCommitsJsonFilename(sha)
        )
      )
      //      commits.push(await json.load<Types.CommitSchema>(filename))
    }
    return commits
  }

  return {
    commits,
    discussions,
    mergerequests,
    releasedCommits,
  }
}
