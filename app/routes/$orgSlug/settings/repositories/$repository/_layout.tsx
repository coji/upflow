import { zx } from '@coji/zodix/v4'
import { Outlet } from 'react-router'
import { z } from 'zod'
import { requireOrgAdmin } from '~/app/libs/auth.server'
import type { Route } from './+types/_layout'
import { getRepository } from './queries.server'

export const handle = {
  breadcrumb: (
    data: Awaited<ReturnType<typeof loader>>,
    params: { orgSlug: string; repository: string },
  ) => ({
    label: `${data.repository.owner}/${data.repository.repo}`,
    to: `/${params.orgSlug}/settings/repositories/${params.repository}`,
  }),
}

export const loader = async ({ request, params }: Route.LoaderArgs) => {
  const { organization } = await requireOrgAdmin(request, params.orgSlug)
  const { repository: repositoryId } = zx.parseParams(params, {
    repository: z.string(),
  })

  const repository = await getRepository(organization.id, repositoryId)
  if (!repository) {
    throw new Response('Repository not found', { status: 404 })
  }

  return { organization, repositoryId, repository }
}

export default function RepositoryLayout() {
  return <Outlet />
}
