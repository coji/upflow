import type { GitLabCommit } from '../model'
import { Gitlab } from '@gitbeaker/node'
import got from 'got'
import { shapeGitLabMergeRequest, shapeGitLabCommit, shapeGitLabDiscussionNote } from '../shaper'
import dayjs from 'dayjs'

export interface createFetcherProps {
  projectId: string
  privateToken: string
}

export const createFetcher = ({ projectId, privateToken }: createFetcherProps) => {
  const api = new Gitlab({ token: privateToken })

  /**
   * 指定ブランチ/タグのコミットリストを取得
   * @param ref_name 対象のブランチ/タグ名
   * @param since この日時以降のコミットをのみ取得する YYYY-MM-DDTHH:MM:SSZ ISO 8601形式
   * @returns
   */
  const refCommits = async (ref_name: string, since?: string) => {
    const commits = []
    let page = 1
    while (true) {
      const ret = await got
        .get(`https://gitlab.com/api/v4/projects/${projectId}/repository/commits`, {
          searchParams: { ref_name, per_page: 100, page, since },
          headers: { 'PRIVATE-TOKEN': privateToken }
        })
        .json<GitLabCommit[]>()

      if (ret.length === 0) break
      commits.push(...ret)
      page++
    }
    return commits.map((commit) => shapeGitLabCommit(commit))
  }

  /**
   * MRのコミットリストを取得
   * @param mergerequestIid
   * @returns 指定したMRのコミット情報の配列
   */
  const commits = async (mergerequestIid: number) =>
    (await api.MergeRequests.commits(projectId, mergerequestIid)).map((commit) => shapeGitLabCommit(commit))

  /**
   * MRのディスカッションリストを取得
   * @param mergerequestIid
   * @returns 指定したMRのディスカッション情報の配列
   */
  const discussions = async (mergerequestIid: number) =>
    (await api.MergeRequestDiscussions.all(projectId, mergerequestIid))
      .map((discussion) => (discussion.notes ? discussion.notes?.map((note) => shapeGitLabDiscussionNote(note)) : []))
      .flat()

  /**
   * プロジェクトのすべてのMR情報を取得
   * @returns プロジェクトのすべてのMR情報の配列
   */
  const mergerequests = async () =>
    (await api.MergeRequests.all({ projectId }))
      .filter((mr) => dayjs(mr.updated_at) > dayjs().add(-90, 'days')) // 90日以上のは除外
      .map((mr) => shapeGitLabMergeRequest(mr))

  return {
    refCommits,
    commits,
    discussions,
    mergerequests
  }
}
