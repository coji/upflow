import type { GitHubPullRequest } from '../model'
import type { MergeRequest } from '@prisma/client'
import dayjs from 'dayjs'
import { createStore } from '../store'

const nullOrDate = (dateStr?: Date | string | null) => {
  return dateStr ? dayjs(dateStr).format() : null
}

export const buildPullRequests = async (
  config: { companyId: string; repositoryId: string },
  pullrequests: GitHubPullRequest[]
) => {
  const store = createStore(config)

  const results: MergeRequest[] = []
  for (const pr of pullrequests) {
    // close じゃない
    const commits = await store.loader.commits(pr.number)
    const discussions = await store.loader.discussions(pr.number)

    // リリースされたコミットにMR マージコミットが含まれるかどうか
    // const releasedCommit =
    //   pr.merge_commit_sha !== undefined &&
    //   pr.merge_commit_sha !== null &&
    //   (await store.loader.releasedCommitsBySha(pr.merge_commit_sha).catch(() => false))

    results.push({
      id: String(pr.number),
      target_branch: '',
      state: pr.state,
      num_of_commits: commits.length || null,
      num_of_comments: discussions.length || null,
      first_commited_at: nullOrDate(commits[0]?.commit.author?.date),
      mergerequest_created_at: nullOrDate(pr.created_at)!,
      first_reviewd_at: nullOrDate(discussions[0]?.created_at),
      merged_at: nullOrDate(pr.merged_at),
      released_at: null,
      is_release_committed: false,
      author: pr.user?.login as string,
      title: pr.title,
      repositoryId: config.repositoryId
    })
  }
  return results
}
