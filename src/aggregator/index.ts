import { Types } from '@gitbeaker/node'
import { createLoader } from '@/loader'
import { firstCommit } from './firstCommit'
import { reviewComments } from './reviewCommits'

export const createAggregator = () => {
  const loader = createLoader()

  /**
   * 最初についたレビューコメントを抽出
   * @param discussions
   * @returns
   */
  const firstReviewComment = (discussions: Types.DiscussionSchema[]) => {
    const comments = reviewComments(discussions)
    if (comments.length === 0) return null
    return comments.reduce((a, b) => (a.created_at < b.created_at ? a : b))
  }

  /**
   * マージ済みプロダクションリリースMRの取得
   * @param allMergeRequests
   * @returns
   */
  const releasedMergeRequests = (allMergeRequests: Types.MergeRequestSchema[]) =>
    allMergeRequests.filter((mr) => mr.target_branch === 'production' && mr.state === 'merged')

  /**
   * リリースにマージされた日時を取得
   * @param targetHash
   * @param allMergeRequests
   * @returns [string|null] マージ日時
   */
  const findReleaseDate = async (allMergeRequests: Types.MergeRequestSchema[], targetHash?: string) => {
    let merged_at = null
    for (const m of releasedMergeRequests(allMergeRequests)) {
      const commits = await loader.commits(m.iid)
      if (commits.some((c) => c.id === targetHash)) {
        merged_at = m.merged_at
      }
    }
    return merged_at
  }

  /**
   * コミットリストに特定のハッシュ含まれるか
   * @param commits リリースのコミット配列
   * @param sha コミットハッシュ
   * @returns 含まれる: true, 含まれない: false
   */
  const isCommitIncluded = (commits: Types.CommitSchema[], sha?: string) => commits.some((commit) => commit.id === sha)

  return {
    firstCommit,
    reviewComments,
    firstReviewComment,
    releasedMergeRequests,
    findReleaseDate,
    isCommitIncluded
  }
}
