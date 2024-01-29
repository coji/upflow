import * as R from 'remeda'
import dayjs from '~/app/libs/dayjs'
import type { ShapedGitHubPullRequest } from '../model'
import type { createStore } from '../store'

const mergedPullRequests = (allPullRequests: ShapedGitHubPullRequest[], targetBranch: string) => {
  return R.pipe(
    allPullRequests,
    R.filter((pr) => pr.targetBranch === targetBranch && pr.state === 'closed' && pr.mergedAt !== null), // 一旦mainブランチ固定
    // biome-ignore lint/style/noNonNullAssertion: <explanation>
    R.sortBy((pr) => pr.mergedAt!),
  )
}

/**
 * ブランチ基準でリリース日を探す
 * @param allPullRequests
 * @param store
 * @param pr
 * @param branch
 * @returns
 */
const findReleaseDateByBranch = async (
  allPullRequests: ShapedGitHubPullRequest[],
  store: ReturnType<typeof createStore>,
  pr: ShapedGitHubPullRequest,
  branch: string,
) => {
  for (const m of mergedPullRequests(allPullRequests, branch)) {
    if ((await store.loader.commits(m.number)).some((c) => c.sha === pr.mergeCommitSha)) {
      return m.mergedAt
    }
  }
  return null
}

/**
 * ブランチ基準でリリース日を探す
 * @param allPullRequests
 * @param store
 * @param pr
 * @param key
 * @returns
 */
const findReleaseDateByTag = async (
  allPullRequests: ShapedGitHubPullRequest[],
  store: ReturnType<typeof createStore>,
  pr: ShapedGitHubPullRequest,
  tagCondition: string,
) => {
  if (pr.mergedAt === null) return null

  const tagRegexp = new RegExp(tagCondition)
  const allReleaseTags = (await store.loader.tags())
    .filter((t) => tagRegexp.test(t.name)) // リリース用のタグを抽出
    // biome-ignore lint/style/noNonNullAssertion: <explanation>
    .sort((a, b) => dayjs(a.committedAt!).unix() - dayjs(b.committedAt!).unix()) // 古い順に並べる

  for (const releaseTag of allReleaseTags) {
    if (dayjs(pr.mergedAt).unix() <= dayjs(releaseTag.committedAt).unix()) {
      return releaseTag.committedAt
    }
  }
  return null
}

export const findReleaseDate = async (
  allPullRequests: ShapedGitHubPullRequest[],
  store: ReturnType<typeof createStore>,
  pr: ShapedGitHubPullRequest,
  releaseDetectionMethod: string,
  releaseDetectionKey: string,
) => {
  if (releaseDetectionMethod === 'branch') {
    return findReleaseDateByBranch(allPullRequests, store, pr, releaseDetectionKey)
  }
  if (releaseDetectionMethod === 'tags') {
    return findReleaseDateByTag(allPullRequests, store, pr, releaseDetectionKey)
  }
  return null
}
