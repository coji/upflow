import { json, type LoaderArgs } from '@remix-run/node'
import { Outlet } from '@remix-run/react'
import { z } from 'zod'
import { zx } from 'zodix'
import { listPullRequests } from '~/app/models/admin/pull-requests.server'
import { getRepository } from '~/app/models/admin/repository.server'

export const handle = {
  breadcrumb: ({
    companyId,
    repositoryId,
    repository,
  }: {
    companyId: string
    repositoryId: string
    repository: Awaited<ReturnType<typeof getRepository>>
  }) => ({
    label: repository?.name,
    to: `/admin/${companyId}/repository/${repositoryId}`,
  }),
}

export const loader = async ({ request, params }: LoaderArgs) => {
  const { companyId, repositoryId } = zx.parseParams(params, { companyId: z.string(), repositoryId: z.string() })
  const repository = await getRepository(repositoryId)
  if (!repository) {
    throw new Error('repository not found')
  }
  const pulls = await listPullRequests(repository.id)
  return json({ companyId, repositoryId, repository, pulls })
}

const RepositoryPullsIndexPage = () => {
  return <Outlet />
}
export default RepositoryPullsIndexPage
