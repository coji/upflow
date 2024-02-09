import type {
  GitHubCommit,
  GitHubPullRequest,
  GitHubReview,
  GitHubReviewComment,
  GithubIssueComment,
  ShapedGitHubCommit,
  ShapedGitHubIssueComment,
  ShapedGitHubPullRequest,
  ShapedGitHubReview,
  ShapedGitHubReviewComment,
} from '../model'

/**
 * GitHubPullRequest を集計に必要な props のみに shape する
 * @param pr
 * @returns
 */
export const shapeGitHubPullRequest: (
  pr: GitHubPullRequest,
) => ShapedGitHubPullRequest = (pr) => {
  return {
    id: pr.id,
    organization: pr.base.repo.owner.login,
    repo: pr.base.repo.name,
    number: pr.number,
    state: pr.state,
    title: pr.title,
    url: pr.html_url,
    author: pr.user?.login ?? null,
    assignees: pr.assignees?.map((assignee) => assignee.login) ?? [],
    reviewers: pr.requested_reviewers?.map((reviewer) => reviewer.login) ?? [],
    draft: pr.draft ? true : false,
    sourceBranch: pr.head.ref,
    targetBranch: pr.base.ref,
    createdAt: pr.created_at,
    updatedAt: pr.updated_at,
    mergedAt: pr.merged_at,
    mergeCommitSha: pr.merge_commit_sha,
  }
}

/**
 * GitHubCommit を集計に必要な props のみに shape する
 * @param commit
 * @returns
 */
export const shapeGitHubCommit: (commit: GitHubCommit) => ShapedGitHubCommit = (
  commit,
) => {
  return {
    sha: commit.sha,
    url: commit.html_url,
    committer: commit.committer?.login ?? null, // author にすると古いのになっちゃうので committer
    date: commit.commit.committer?.date ?? null,
  }
}

/**
 * GitHubIssueComment を集計に必要な props のみに shape する
 */
export const shapeGitHubIssueComment: (
  comment: GithubIssueComment,
) => ShapedGitHubIssueComment = (comment) => {
  return {
    id: comment.id,
    user: comment.user?.login ?? null,
    url: comment.html_url,
    createdAt: comment.created_at,
  }
}

/**
 * GitHubReviewComment を集計に必要な props のみに shape する
 * @param comment
 * @returns
 */
export const shapeGitHubReviewComment: (
  comment: GitHubReviewComment,
) => ShapedGitHubReviewComment = (comment) => {
  return {
    id: comment.id,
    user: comment.user?.login ?? null,
    url: comment.html_url,
    createdAt: comment.created_at,
  }
}

/**
 * GitHubReview を集計に必要な props のみに shape する
 * @param review
 * @returns
 */
export const shapeGitHubReview: (review: GitHubReview) => ShapedGitHubReview = (
  review,
) => {
  return {
    id: review.id,
    user: review.user?.login ?? null,
    state: review.state,
    url: review.html_url,
    submittedAt: review.submitted_at ?? null,
  }
}
