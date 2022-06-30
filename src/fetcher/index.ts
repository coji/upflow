import { Types } from '@gitbeaker/node'
import got from 'got'

export const createFetcher = (api: any) => {
  const privateToken = process.env.PRIVATE_TOKEN
  const projectId = process.env.PROJECT_ID
  return {
    releaseCommits: async (ref_name: string) => {
      const commits = []
      let page = 1
      while (true) {
        const ret = await got
          .get(
            `https://gitlab.com/api/v4/projects/${projectId}/repository/commits`,
            {
              searchParams: { all: true, ref_name, per_page: 100, page },
              headers: { 'PRIVATE-TOKEN': privateToken },
            }
          )
          .json<Types.CommitSchema[]>()

        if (ret.length === 0) break
        commits.push(...ret)
        page++
      }
      return commits
    },

    /**
     * MRのコミットリストを取得
     * @param mergerequestIid
     * @returns 指定したMRのコミット情報の配列
     */
    commits: async (mergerequestIid: number) =>
      (await api.MergeRequests.commits(
        projectId,
        mergerequestIid
      )) as Types.CommitSchema[],
    /**
     * MRのディスカッションリストを取得
     * @param mergerequestIid
     * @returns 指定したMRのディスカッション情報の配列
     */
    discussions: async (mergerequestIid: number) =>
      (await api.MergeRequestDiscussions.all(
        projectId,
        mergerequestIid
      )) as Types.DiscussionSchema[],
    /**
     * プロジェクトのすべてのMR情報を取得
     * @returns プロジェクトのすべてのMR情報の配列
     */
    mergerequests: async () =>
      (await api.MergeRequests.all({
        projectId,
      })) as Types.MergeRequestSchema[],
  }
}
