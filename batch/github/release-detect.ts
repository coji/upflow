import * as R from 'remeda'
import { logger } from '~/batch/helper/logger'
import type { ShapedGitHubPullRequest } from './model'
import type { PullRequestLoaders } from './types'

/**
 * ブランチ基準のリリース日ルックアップを事前構築する。
 * mergeCommitSha → releasedAt のマップを返す。
 */
export async function buildBranchReleaseMap(
  allPullRequests: ShapedGitHubPullRequest[],
  loaders: Pick<PullRequestLoaders, 'commits'>,
  releaseBranch: string,
): Promise<Map<string, string>> {
  const releaseMap = new Map<string, string>()

  // リリースブランチにマージされた PR を古い順に取得
  const releasePrs = R.pipe(
    allPullRequests,
    R.filter(
      (pr) =>
        pr.targetBranch === releaseBranch &&
        pr.state === 'closed' &&
        pr.mergedAt !== null,
    ),
    // biome-ignore lint/style/noNonNullAssertion: mergedAt is guaranteed non-null by filter above
    R.sortBy((pr) => pr.mergedAt!),
  )

  for (const releasePr of releasePrs) {
    const commits = await loaders.commits(releasePr.number)
    for (const commit of commits) {
      // 最初に見つかったリリース PR が最も早いリリース
      if (!releaseMap.has(commit.sha)) {
        // biome-ignore lint/style/noNonNullAssertion: mergedAt is guaranteed non-null by filter above
        releaseMap.set(commit.sha, releasePr.mergedAt!)
      }
    }
  }

  return releaseMap
}

/**
 * タグ基準のリリース日ルックアップ用にソート済みタグリストを構築する。
 */
export async function buildTagReleaseList(
  loaders: Pick<PullRequestLoaders, 'tags'>,
  tagCondition: string,
): Promise<{ committedAt: string }[]> {
  let tagRegexp: RegExp
  try {
    tagRegexp = new RegExp(tagCondition)
  } catch {
    logger.error(`Invalid tag regex pattern: ${tagCondition}`)
    return []
  }

  const allTags = await loaders.tags()
  return allTags
    .filter((t) => tagRegexp.test(t.name))
    .sort((a, b) => a.committedAt.localeCompare(b.committedAt))
}

/**
 * タグリストから PR のリリース日を O(log n) で検索する。
 * sortedTags は committedAt 昇順。
 */
export function findReleaseDateFromTags(
  mergedAt: string,
  sortedTags: { committedAt: string }[],
): string | null {
  // mergedAt 以降の最初のタグを探す（二分探索）
  let lo = 0
  let hi = sortedTags.length
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (sortedTags[mid].committedAt < mergedAt) {
      lo = mid + 1
    } else {
      hi = mid
    }
  }
  return lo < sortedTags.length ? sortedTags[lo].committedAt : null
}
