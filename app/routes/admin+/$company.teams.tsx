import type { LoaderFunctionArgs } from 'react-router'
import { Outlet } from 'react-router'
import { $path } from 'safe-routes'
import { z } from 'zod'
import { zx } from 'zodix'
import { Stack } from '~/app/components/ui'

export const handle = {
  breadcrumb: ({ companyId }: { companyId: string }) => ({
    label: 'Teams',
    to: $path('/admin/:company/teams', { company: companyId }),
  }),
}

export const loader = ({ params }: LoaderFunctionArgs) => {
  const { company: companyId } = zx.parseParams(params, {
    company: z.string(),
  })
  return { companyId }
}

export default function TeamPage() {
  return (
    <Stack>
      <Outlet />
    </Stack>
  )
}
