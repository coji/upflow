import { Types } from '@gitbeaker/node'

export const fetchFactory = (api: any) => {
  const projectId = process.env.PROJECT_ID
  return {
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
