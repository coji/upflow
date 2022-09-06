import type { ShapedGitLabCommit } from '../model'
/**
 * コミットリストに特定のハッシュ含まれるか
 * @param commits リリースのコミット配列
 * @param sha コミットハッシュ
 * @returns 含まれる: true, 含まれない: false
 */
export const isCommitIncluded = (commits: ShapedGitLabCommit[], sha?: string) => {
  return commits.some((commit) => commit.sha === sha)
}
