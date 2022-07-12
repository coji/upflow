import * as z from 'zod'

export const MergeRequestModel = z.object({
  id: z.string(),
  target_branch: z.string(),
  state: z.string(),
  num_of_commits: z.number().int(),
  num_of_comments: z.number().int(),
  first_commited_at: z.date().nullish(),
  mergerequest_created_at: z.date(),
  first_reviewd_at: z.date().nullish(),
  merged_at: z.date().nullish(),
  released_at: z.date().nullish(),
  is_release_committed: z.boolean(),
  author: z.string(),
  title: z.string()
})
