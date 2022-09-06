import type { GitHubPullRequest } from '../model'
import type { ShapedGitHubPullRequest } from '../model'

/**
 *
 * @param pr
 * @returns
 */
export const shapeGitHubPullRequest: (pr: GitHubPullRequest) => ShapedGitHubPullRequest = (pr: GitHubPullRequest) => {
  return {
    number: pr.number,
    state: pr.state,
    title: pr.title,
    url: pr.html_url,
    author: pr.base.user?.login ?? null,
    targetBranch: pr.base.ref,
    repo: pr.base.repo.name,
    createdAt: pr.created_at,
    updatedAt: pr.updated_at,
    mergedAt: pr.merged_at,
    mergeCommitSha: pr.merge_commit_sha
  }
}
