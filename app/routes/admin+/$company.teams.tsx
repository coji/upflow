import { Outlet } from 'react-router'
import { $path } from 'safe-routes'
import { z } from 'zod'
import { zx } from 'zodix'
import { Stack } from '~/app/components/ui'
import type { Route } from './+types/$company.teams'

export const handle = {
  breadcrumb: ({ companyId }: Awaited<ReturnType<typeof loader>>) => ({
    label: 'Teams',
    to: $path('/admin/:company/teams', { company: companyId }),
  }),
}

export const loader = ({ params }: Route.LoaderArgs) => {
  const { company: companyId } = zx.parseParams(params, {
    company: z.string(),
  })
  return { companyId }
}

export default function TeamPage({ loaderData }: Route.ComponentProps) {
  return (
    <Stack>
      <Outlet />
    </Stack>
  )
}
