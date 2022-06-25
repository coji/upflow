import { Types } from '@gitbeaker/node'
import { json, path } from '../helper/index'

export const loader = {
  commits: async (mergerequestIid: number) =>
    json.load<Types.CommitSchema[]>(path.commitsJsonFilename(mergerequestIid)),
  discussions: async (mergerequestIid: number) =>
    json.load<Types.DiscussionSchema[]>(
      path.discussionsJsonFilename(mergerequestIid)
    ),
  mergerequests: async () =>
    json.load<Types.MergeRequestSchema[]>('mergerequests.json'),
}
