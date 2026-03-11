import { logger } from '~/batch/helper/logger'
import type { ShapedGitHubPullRequest } from './model'
import type { PullRequestLoaders } from './types'

// --- ブランチ方式リリース検出（グラフ + タイムスタンプ） ---

type BranchEdge = { targetBranch: string; mergedAt: string }
type AdjacencyList = Map<string, BranchEdge[]>

/**
 * merged PR 群から sourceBranch ごとの adjacency list を構築する。
 * 各 adjacency は mergedAt 昇順でソート（二分探索のため）。
 */
function buildAdjacencyList(
  mergedPrs: Array<{
    sourceBranch: string
    targetBranch: string
    mergedAt: string
  }>,
): AdjacencyList {
  const adj: AdjacencyList = new Map()
  for (const pr of mergedPrs) {
    let edges = adj.get(pr.sourceBranch)
    if (!edges) {
      edges = []
      adj.set(pr.sourceBranch, edges)
    }
    edges.push({ targetBranch: pr.targetBranch, mergedAt: pr.mergedAt })
  }
  for (const edges of adj.values()) {
    edges.sort((a, b) => a.mergedAt.localeCompare(b.mergedAt))
  }
  return adj
}

/**
 * BFS で startBranch → releaseBranch への到達パスを探索し、
 * valid path のうち final-hop mergedAt が最小のものを返す。
 *
 * 前提: mergedAt は ISO-8601 形式で文字列の辞書順比較が時刻順と一致する。
 *
 * 枝刈り: bestSeen[branch] に、そのブランチに到達した最小 minTime を記録。
 * 新しい到達の minTime >= bestSeen なら支配されているので枝刈り。
 */
function findEarliestRelease(
  startBranch: string,
  afterTime: string,
  releaseBranch: string,
  adj: AdjacencyList,
): string | null {
  const queue: Array<{ branch: string; minTime: string }> = [
    { branch: startBranch, minTime: afterTime },
  ]
  const bestSeen = new Map<string, string>()
  bestSeen.set(startBranch, afterTime)

  let earliestRelease: string | null = null
  let head = 0

  while (head < queue.length) {
    const { branch, minTime } = queue[head++]

    const edges = adj.get(branch)
    if (!edges) continue

    // 二分探索で minTime 以降の最初のエッジを見つける
    let lo = 0
    let hi = edges.length
    while (lo < hi) {
      const mid = (lo + hi) >>> 1
      if (edges[mid].mergedAt < minTime) lo = mid + 1
      else hi = mid
    }

    for (let i = lo; i < edges.length; i++) {
      const edge = edges[i]

      if (edge.targetBranch === releaseBranch) {
        if (!earliestRelease || edge.mergedAt < earliestRelease) {
          earliestRelease = edge.mergedAt
        }
        // 昇順ソート済みなので、この sourceBranch からの最小 final-hop は確定
        break
      }

      // 支配判定: より早い minTime で到達済みなら枝刈り
      const prevBest = bestSeen.get(edge.targetBranch)
      if (prevBest && prevBest <= edge.mergedAt) continue

      bestSeen.set(edge.targetBranch, edge.mergedAt)
      queue.push({ branch: edge.targetBranch, minTime: edge.mergedAt })
    }
  }

  return earliestRelease
}

/**
 * ブランチ到達グラフ + タイムスタンプ方式でリリース日を判定する。
 * prNumber → releasedAt のマップを返す。
 *
 * - 直接ターゲット: feature → releaseBranch → releasedAt = mergedAt
 * - 間接リリース: BFS で推移的到達を探索し、最も早い final-hop の mergedAt を返す
 * - commits ロード不要（SHA に依存しない）。全マージ方式（merge commit / squash / rebase）で動作。
 */
export function buildBranchReleaseLookup(
  allPullRequests: ShapedGitHubPullRequest[],
  releaseBranch: string,
): Map<number, string> {
  const result = new Map<number, string>()

  type MergedPr = ShapedGitHubPullRequest & { mergedAt: string }
  const mergedPrs = allPullRequests.filter(
    (pr): pr is MergedPr => pr.state === 'closed' && pr.mergedAt !== null,
  )

  const adj = buildAdjacencyList(
    mergedPrs.map((pr) => ({
      sourceBranch: pr.sourceBranch,
      targetBranch: pr.targetBranch,
      mergedAt: pr.mergedAt,
    })),
  )

  for (const pr of mergedPrs) {
    // 直接ターゲット: feature → releaseBranch
    if (pr.targetBranch === releaseBranch) {
      result.set(pr.number, pr.mergedAt)
      continue
    }

    // 推移的到達: targetBranch → ... → releaseBranch
    const releasedAt = findEarliestRelease(
      pr.targetBranch,
      pr.mergedAt,
      releaseBranch,
      adj,
    )
    if (releasedAt) {
      result.set(pr.number, releasedAt)
    }
  }

  return result
}

// --- タグ方式リリース検出（既存、変更なし） ---

/**
 * タグ基準のリリース日ルックアップ用にソート済みタグリストを構築する。
 */
export async function buildTagReleaseList(
  loaders: Pick<PullRequestLoaders, 'tags'>,
  tagCondition: string,
): Promise<{ committedAt: string }[]> {
  if (tagCondition.length > 200) {
    logger.error(`Tag regex pattern too long (${tagCondition.length} chars)`)
    return []
  }

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
