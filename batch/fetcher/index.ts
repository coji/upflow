import type { Types, Gitlab } from '@gitbeaker/node'
import got from 'got'

export const createFetcher = (api: InstanceType<typeof Gitlab>) => {
  const privateToken = process.env.PRIVATE_TOKEN || ''
  const projectId = process.env.PROJECT_ID || ''

  /**
   * 指定ブランチ/タグのコミットリストを取得
   * @param ref_name 対象のブランチ/タグ名
   * @param since この日時以降のコミットをのみ取得する YYYY-MM-DDTHH:MM:SSZ ISO 8601形式
   * @returns
   */
  const refCommits = async (ref_name: string, since?: string) => {
    const commits = []
    let page = 1
    for (;;) {
      const ret = await got
        .get(`https://gitlab.com/api/v4/projects/${projectId}/repository/commits`, {
          searchParams: { ref_name, per_page: 100, page, since },
          headers: { 'PRIVATE-TOKEN': privateToken }
        })
        .json<Types.CommitSchema[]>()

      if (ret.length === 0) break
      commits.push(...ret)
      page++
    }
    return commits
  }

  /**
   * MRのコミットリストを取得
   * @param mergerequestIid
   * @returns 指定したMRのコミット情報の配列
   */
  const mergerequestCommits = async (mergerequestIid: number) => await api.MergeRequests.commits(projectId, mergerequestIid)

  /**
   * MRのディスカッションリストを取得
   * @param mergerequestIid
   * @returns 指定したMRのディスカッション情報の配列
   */
  const discussions = async (mergerequestIid: number) => await api.MergeRequestDiscussions.all(projectId, mergerequestIid)

  /**
   * プロジェクトのすべてのMR情報を取得
   * @returns プロジェクトのすべてのMR情報の配列
   */
  const mergerequests = async () => await api.MergeRequests.all({ projectId })

  return {
    refCommits,
    mergerequestCommits,
    discussions,
    mergerequests
  }
}
