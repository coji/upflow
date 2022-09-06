import type {
  GitHubPullRequest,
  GitHubCommit,
  GitHubReviewComment,
  ShapedGitHubPullRequest,
  ShapedGitHubCommit,
  ShapedGitHubReviewComment
} from '../model'

/**
 * GitHubPullRequest を集計に必要な props のみに shape する
 * @param pr
 * @returns
 */
export const shapeGitHubPullRequest: (pr: GitHubPullRequest) => ShapedGitHubPullRequest = (pr: GitHubPullRequest) => {
  return {
    number: pr.number,
    state: pr.state,
    title: pr.title,
    url: pr.html_url,
    author: pr.user?.login ?? null,
    sourceBranch: pr.head.ref,
    targetBranch: pr.base.ref,
    repo: pr.base.repo.name,
    createdAt: pr.created_at,
    updatedAt: pr.updated_at,
    mergedAt: pr.merged_at,
    mergeCommitSha: pr.merge_commit_sha
  }
}

/**
 * GitHubCommit を集計に必要な props のみに shape する
 * @param commit
 * @returns
 */
export const shapeGitHubCommit: (commit: GitHubCommit) => ShapedGitHubCommit = (commit: GitHubCommit) => {
  return {
    sha: commit.sha,
    url: commit.html_url,
    author: commit.author?.login ?? null,
    date: commit.commit.author?.date ?? null
  }
}

/**
 * GitHubReviewComment を集計に必要な props のみに shape する
 * @param comment
 * @returns
 */
export const shapeGitHubReviewComment: (comment: GitHubReviewComment) => ShapedGitHubReviewComment = (
  comment: GitHubReviewComment
) => {
  return {
    id: comment.id,
    user: comment.user.login,
    url: comment.html_url,
    createdAt: comment.created_at
  }
}
