import { json, type LoaderArgs } from '@remix-run/node'
import { useLoaderData } from '@remix-run/react'
import { z } from 'zod'
import { zx } from 'zodix'
import { getPullRequest } from '~/app/models/admin/pull-requests.server'

export const handle = {
  breadcrumb: ({
    companyId,
    repositoryId,
    pull,
  }: {
    companyId: string
    repositoryId: string
    pull: Awaited<ReturnType<typeof getPullRequest>>
  }) => ({
    label: pull?.number,
    to: `/admin/${companyId}/repository/${repositoryId}/${pull.number}`,
  }),
}

export const loader = async ({ request, params }: LoaderArgs) => {
  const { companyId, repositoryId, pullId } = zx.parseParams(params, {
    companyId: z.string(),
    repositoryId: z.string(),
    pullId: zx.NumAsString,
  })
  const pull = await getPullRequest(pullId)
  return json({ companyId, repositoryId, pull })
}

const RepositoryPullsIndexPage = () => {
  const { pull } = useLoaderData<typeof loader>()

  return (
    <div>
      <pre>{JSON.stringify(pull, null, 2)}</pre>
    </div>
  )
}
export default RepositoryPullsIndexPage
