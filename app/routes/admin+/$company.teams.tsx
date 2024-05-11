import { unstable_defineLoader as defineLoader } from '@remix-run/node'
import { Outlet } from '@remix-run/react'
import { $path } from 'remix-routes'
import { z } from 'zod'
import { zx } from 'zodix'
import { Stack } from '~/app/components/ui'

export const handle = {
  breadcrumb: ({ companyId }: { companyId: string }) => ({
    label: 'Teams',
    to: $path('/admin/:company/teams', { company: companyId }),
  }),
}

export const loader = defineLoader(({ params }) => {
  const { company: companyId } = zx.parseParams(params, { company: z.string() })
  return { companyId }
})

export default function TeamPage() {
  return (
    <Stack>
      <Outlet />
    </Stack>
  )
}
