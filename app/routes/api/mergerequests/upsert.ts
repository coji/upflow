import type { ActionArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import type { MergeRequest } from '~/app/models/mergeRequest.server'
import { upsertMergeRequest } from '~/app/models/mergeRequest.server'

export const action = async ({ request, params, context }: ActionArgs) => {
  const mergeRequest = (await request.json()).item as MergeRequest
  await upsertMergeRequest(mergeRequest)
  return json({ result: 'ok' })
}
