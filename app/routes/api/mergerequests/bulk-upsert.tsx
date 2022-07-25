import type { LoaderFunction, ActionFunction } from '@remix-run/server-runtime'
import { json } from '@remix-run/server-runtime'
import type { MergeRequest } from '~/app/models/mergeRequest.server'
import { upsertMergeRequest } from '~/app/models/mergeRequest.server'

export const loader: LoaderFunction = () => json({ result: 'error', message: 'method not allowed' }, 405)

export const action: ActionFunction = async ({ request, params, context }) => {
  const mergeRequests = (await request.json()).items as MergeRequest[]
  console.log(mergeRequests)
  for (const mr of mergeRequests) {
    console.log('upsert', await upsertMergeRequest(mr))
  }
  return json({ result: 'ok' })
}
