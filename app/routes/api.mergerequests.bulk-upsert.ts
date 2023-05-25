import type { ActionArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import type { PullRequest } from '~/app/models/pullRequest.server'
import { upsertPullRequest } from '~/app/models/pullRequest.server'

export const action = async ({ request, params, context }: ActionArgs) => {
  const mergeRequests = (await request.json()).items as PullRequest[]
  console.log(mergeRequests)
  for (const mr of mergeRequests) {
    console.log('upsert', await upsertPullRequest(mr))
  }
  return json({ result: 'ok' })
}
