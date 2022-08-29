import type { Types } from '@gitbeaker/node'
/**
 * コミットリストに特定のハッシュ含まれるか
 * @param commits リリースのコミット配列
 * @param sha コミットハッシュ
 * @returns 含まれる: true, 含まれない: false
 */
export const isCommitIncluded = (commits: Types.CommitSchema[], sha?: string) => {
  return commits.some((commit) => commit.id === sha)
}
