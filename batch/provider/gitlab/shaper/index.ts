import type {
  GitLabCommit,
  GitLabDiscussionNote,
  GitLabMergeRequest,
  ShapedGitLabCommit,
  ShapedGitLabDiscussionNote,
  ShapedGitLabMergeRequest,
} from '../model'

/**
 * GitLabMergeRequest を集計に必要な props のみに shape する
 * @param mr
 * @returns
 */
export const shapeGitLabMergeRequest: (mr: GitLabMergeRequest) => ShapedGitLabMergeRequest = (
  mr: GitLabMergeRequest,
) => {
  return {
    projectId: mr.project_id,
    iid: mr.iid,
    state: mr.state,
    title: mr.title,
    url: mr.web_url,
    author: mr.author.username as string,
    sourceBranch: mr.source_branch,
    targetBranch: mr.target_branch,
    createdAt: mr.created_at,
    updatedAt: mr.updated_at,
    mergedAt: mr.merged_at,
    mergeCommitSha: mr.merge_commit_sha ?? null,
  }
}

/**
 * GitLabCommit を集計に必要な props のみに shape する
 * @param commit
 * @returns
 */
export const shapeGitLabCommit: (commit: GitLabCommit) => ShapedGitLabCommit = (commit: GitLabCommit) => {
  return {
    sha: commit.id,
    url: commit.web_url,
    committer: commit.committer_name || commit.author_name, // author にすると古いのになるので commiter を先に使う
    createdAt: (commit.committed_date || commit.created_at) as unknown as string, // defined as Date but actual type is string
  }
}

/**
 * GitLabDiscussionNote を集計に必要な props のみに shape する
 * @param comment
 * @returns
 */
export const shapeGitLabDiscussionNote: (comment: GitLabDiscussionNote) => ShapedGitLabDiscussionNote = (
  comment: GitLabDiscussionNote,
) => {
  return {
    id: comment.id,
    author: comment.author.username as string,
    type: comment.type ?? null,
    createdAt: comment.created_at,
  }
}
