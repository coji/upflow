import * as R from 'remeda'
import dayjs from '~/app/libs/dayjs'
import type { ShapedGitHubPullRequest } from './model'
import type { PullRequestLoaders } from './types'

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
    // biome-ignore lint/style/noNonNullAssertion: merged_atはnullじゃないことが保証されている
    R.sortBy((pr) => pr.merged_at!),
  )
}

/**
 * ブランチ基準でリリース日を探す
 * @param allPullRequests
 * @param loaders
 * @param pr
 * @param branch
 * @returns
 */
const findReleaseDateByBranch = async (
  allPullRequests: ShapedGitHubPullRequest[],
  loaders: Pick<PullRequestLoaders, 'commits'>,
  pr: ShapedGitHubPullRequest,
  branch: string,
) => {
  for (const m of mergedPullRequests(allPullRequests, branch)) {
    if (
      (await loaders.commits(m.number)).some(
        (c) => c.sha === pr.merge_commit_sha,
      )
    ) {
      return m.merged_at
    }
  }
  return null
}

/**
 * タグ基準でリリース日を探す
 * @param allPullRequests
 * @param loaders
 * @param pr
 * @param tagCondition
 * @returns
 */
const findReleaseDateByTag = async (
  _allPullRequests: ShapedGitHubPullRequest[],
  loaders: Pick<PullRequestLoaders, 'tags'>,
  pr: ShapedGitHubPullRequest,
  tagCondition: string,
) => {
  if (pr.merged_at === null) return null

  const tagRegexp = new RegExp(tagCondition)
  const allReleaseTags = (await loaders.tags())
    .filter((t) => tagRegexp.test(t.name)) // リリース用のタグを抽出
    .sort((a, b) => dayjs(a.committed_at).unix() - dayjs(b.committed_at).unix()) // 古い順に並べる

  for (const releaseTag of allReleaseTags) {
    if (dayjs(pr.merged_at).unix() <= dayjs(releaseTag.committed_at).unix()) {
      return releaseTag.committed_at
    }
  }
  return null
}

export const findReleaseDate = async (
  allPullRequests: ShapedGitHubPullRequest[],
  loaders: Pick<PullRequestLoaders, 'commits' | 'tags'>,
  pr: ShapedGitHubPullRequest,
  releaseDetectionMethod: string,
  releaseDetectionKey: string,
) => {
  if (releaseDetectionMethod === 'branch') {
    return await findReleaseDateByBranch(
      allPullRequests,
      loaders,
      pr,
      releaseDetectionKey,
    )
  }
  if (releaseDetectionMethod === 'tags') {
    return await findReleaseDateByTag(
      allPullRequests,
      loaders,
      pr,
      releaseDetectionKey,
    )
  }
  return null
}
