import type { LoaderFunctionArgs } from '@remix-run/node'
import { Outlet } from '@remix-run/react'
import { $path } from 'remix-routes'
import { z } from 'zod'
import { zx } from 'zodix'
import { Stack } from '~/app/components/ui'

export const handle = {
  breadcrumb: ({ companyId }: { companyId: string }) => ({
    label: 'Teams',
    to: $path('/admin/:companyId/teams', { companyId }),
  }),
}

export const loader = ({ params }: LoaderFunctionArgs) => {
  const { companyId } = zx.parseParams(params, { companyId: z.string() })
  return { companyId }
}

export default function TeamPage() {
  return (
    <Stack>
      <Outlet />
    </Stack>
  )
}
