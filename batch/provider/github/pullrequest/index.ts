import type { GitHubPullRequest } from '../model'
import type { PullRequest } from '@prisma/client'
import dayjs from 'dayjs'
import { createStore } from '../store'
import { codingTime, pickupTime, reviewTime, deployTime, totalTime } from '~/batch/bizlogic/cycletime'

const nullOrDate = (dateStr?: Date | string | null) => {
  return dateStr ? dayjs(dateStr).format() : null
}

export const buildPullRequests = async (
  config: { companyId: string; repositoryId: string },
  pullrequests: GitHubPullRequest[]
) => {
  const store = createStore(config)

  const results: PullRequest[] = []
  for (const pr of pullrequests) {
    // close じゃない
    const commits = await store.loader.commits(pr.number)
    const discussions = await store.loader.discussions(pr.number)

    const firstCommittedAt = nullOrDate(commits[0]?.commit.author?.date)
    const pullRequestCreatedAt = nullOrDate(pr.created_at)!
    const firstReviewedAt = nullOrDate(discussions[0]?.created_at)
    const mergedAt = nullOrDate(pr.merged_at)
    const releasedAt = null // TODO: releasedAt をちゃんと計算

    // リリースされたコミットにMR マージコミットが含まれるかどうか
    const isReleased =
      pr.merge_commit_sha !== undefined &&
      pr.merge_commit_sha !== null &&
      (await store.loader.releasedCommitsBySha(pr.merge_commit_sha).catch(() => null)) != null

    results.push({
      repo: pr.base.repo.name,
      number: String(pr.number),
      targetBranch: pr.base.ref,
      state: pr.state,
      author: pr.user?.login as string,
      title: pr.title,
      url: pr.html_url,
      isReleased,
      firstCommittedAt,
      pullRequestCreatedAt,
      firstReviewedAt,
      mergedAt,
      releasedAt: null,
      codingTime: codingTime({ firstCommittedAt, pullRequestCreatedAt }),
      pickupTime: pickupTime({ pullRequestCreatedAt, firstReviewedAt, mergedAt }),
      reviewTime: reviewTime({ firstReviewedAt, mergedAt }),
      deployTime: deployTime({ mergedAt, releasedAt }),
      totalTime: totalTime({ firstCommittedAt, pullRequestCreatedAt, firstReviewedAt, mergedAt, releasedAt }),
      repositoryId: config.repositoryId
    })
  }
  return results
}
