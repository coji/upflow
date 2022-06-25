import { Types } from '@gitbeaker/node'

export const fetchFactory = (api: any) => ({
  /**
   * MRのコミットリストを取得
   * @param mergerequestIid
   * @returns 指定したMRのコミット情報の配列
   */
  commits: async (mergerequestIid: number) =>
    (await api.MergeRequests.commits(
      process.env.PROJECT_ID!,
      mergerequestIid
    )) as Types.CommitSchema[],
  /**
   * MRのディスカッションリストを取得
   * @param mergerequestIid
   * @returns 指定したMRのディスカッション情報の配列
   */
  discussions: async (mergerequestIid: number) =>
    (await api.MergeRequestDiscussions.all(
      process.env.PROJECT_ID!,
      mergerequestIid
    )) as Types.DiscussionSchema[],
  /**
   * プロジェクトのすべてのMR情報を取得
   * @returns プロジェクトのすべてのMR情報の配列
   */
  mergerequests: async () =>
    (await api.MergeRequests.all({
      projectId: process.env.PROJECT_ID!,
    })) as Types.MergeRequestSchema[],
})
