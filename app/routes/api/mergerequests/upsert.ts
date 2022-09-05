import type { ActionArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import type { PullRequest } from '~/app/models/pullRequest.server'
import { upsertPullRequest } from '~/app/models/pullRequest.server'

export const action = async ({ request, params, context }: ActionArgs) => {
  const mergeRequest = (await request.json()).item as PullRequest
  await upsertPullRequest(mergeRequest)
  return json({ result: 'ok' })
}
