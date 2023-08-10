import type {
  CommitSchema,
  DiscussionNoteSchema,
  DiscussionSchema,
  MergeRequestSchema,
  MilestoneSchema,
} from '@gitbeaker/rest'

export type GitLabMergeRequest = MergeRequestSchema
export type GitLabMilestone = MilestoneSchema
export type GitLabCommit = CommitSchema
export type GitLabDiscussion = DiscussionSchema
export type GitLabDiscussionNote = DiscussionNoteSchema

export interface ShapedGitLabMergeRequest {
  projectId: GitLabMergeRequest['project_id']
  iid: GitLabMergeRequest['iid']
  state: GitLabMergeRequest['state']
  title: GitLabMergeRequest['title']
  url: GitLabMergeRequest['web_url']
  author: string // GitLabMergeRequest['author']['username']
  sourceBranch: GitLabMergeRequest['source_branch']
  targetBranch: GitLabMergeRequest['target_branch']
  createdAt: GitLabMergeRequest['created_at']
  updatedAt: GitLabMergeRequest['updated_at']
  mergedAt: GitLabMergeRequest['merged_at'] | null
  mergeCommitSha: NonNullable<GitLabMergeRequest['merge_commit_sha']> | null
}

export interface ShapedGitLabCommit {
  sha: GitLabCommit['id']
  url: GitLabCommit['web_url']
  committer: GitLabCommit['author_name']
  createdAt: string // GitLabCommit['created_at'] // defined as Date but actual type is string
}

export interface ShapedGitLabDiscussion {
  notes: ShapedGitLabDiscussionNote[]
}
export interface ShapedGitLabDiscussionNote {
  id: GitLabDiscussionNote['id']
  author: string //  GitLabDiscussionNote['author']['username']
  type: NonNullable<GitLabDiscussionNote['type']> | null
  createdAt: GitLabDiscussionNote['created_at']
}
