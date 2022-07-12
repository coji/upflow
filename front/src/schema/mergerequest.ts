import * as z from 'zod'

export const MergeRequestSchema = z.object({
  id: z.string(),
  target_branch: z.string(),
  state: z.string(),
  num_of_commits: z.number().int().nullish(),
  num_of_comments: z.number().int().nullish(),
  first_commited_at: z.string().nullish(),
  mergerequest_created_at: z.string(),
  first_reviewd_at: z.string().nullish(),
  merged_at: z.string().nullish(),
  released_at: z.string().nullish(),
  is_release_committed: z.boolean(),
  author: z.string(),
  title: z.string()
})
