import { LoaderFunctionArgs } from '@remix-run/node'
import { Outlet } from '@remix-run/react'
import { z } from 'zod'
import { zx } from 'zodix'
import { Stack } from '~/app/components/ui'

export const handle = {
  breadcrumb: ({ companyId }: { companyId: string }) => ({
    label: 'チーム',
    to: `/admin/${companyId}/team`,
  }),
}

export const loader = async ({ params }: LoaderFunctionArgs) => {
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
