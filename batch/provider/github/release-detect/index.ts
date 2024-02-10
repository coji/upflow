import * as R from 'remeda'
import dayjs from '~/app/libs/dayjs'
import type { ShapedGitHubPullRequest } from '../model'
import type { createStore } from '../store'

const mergedPullRequests = (
  allPullRequests: ShapedGitHubPullRequest[],
  targetBranch: string,
) => {
  return R.pipe(
    allPullRequests,
    R.filter(
      (pr) =>
        pr.target_branch === targetBranch &&
        pr.state === 'closed' &&
        pr.merged_at !== null,
    ), // 一旦mainブランチ固定
    // biome-ignore lint/style/noNonNullAssertion: <explanation>
    R.sortBy((pr) => pr.merged_at!),
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
    if (
      (await store.loader.commits(m.number)).some(
        (c) => c.sha === pr.merge_commit_sha,
      )
    ) {
      return m.merged_at
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
  if (pr.merged_at === null) return null

  const tagRegexp = new RegExp(tagCondition)
  const allReleaseTags = (await store.loader.tags())
    .filter((t) => tagRegexp.test(t.name)) // リリース用のタグを抽出
    .sort(
      // biome-ignore lint/style/noNonNullAssertion: <explanation>
      (a, b) => dayjs(a.committed_at!).unix() - dayjs(b.committed_at!).unix(),
    ) // 古い順に並べる

  for (const releaseTag of allReleaseTags) {
    if (dayjs(pr.merged_at).unix() <= dayjs(releaseTag.committed_at).unix()) {
      return releaseTag.committed_at
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
    return await findReleaseDateByBranch(
      allPullRequests,
      store,
      pr,
      releaseDetectionKey,
    )
  }
  if (releaseDetectionMethod === 'tags') {
    return await findReleaseDateByTag(
      allPullRequests,
      store,
      pr,
      releaseDetectionKey,
    )
  }
  return null
}
