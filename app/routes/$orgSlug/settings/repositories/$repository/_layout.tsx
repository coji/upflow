import { zx } from '@coji/zodix/v4'
import { Outlet, href } from 'react-router'
import { z } from 'zod'
import { orgContext } from '~/app/middleware/context'
import type { Route } from './+types/_layout'
import { getRepository } from './queries.server'

export const handle = {
  breadcrumb: (
    data: Awaited<ReturnType<typeof loader>>,
    params: { orgSlug: string; repository: string },
  ) => ({
    label: `${data.repository.owner}/${data.repository.repo}`,
    to: href('/:orgSlug/settings/repositories/:repository', {
      orgSlug: params.orgSlug,
      repository: params.repository,
    }),
  }),
}

export const loader = async ({ params, context }: Route.LoaderArgs) => {
  const { organization } = context.get(orgContext)
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
