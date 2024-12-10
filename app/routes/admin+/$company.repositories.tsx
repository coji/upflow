import type { ActionFunctionArgs } from 'react-router'
import { $path } from 'safe-routes'
import { z } from 'zod'
import { zx } from 'zodix'

export const handle = {
  breadcrumb: ({ companyId }: { companyId: string }) => ({
    label: 'Repositories',
    to: $path('/admin/:company/repositories', { company: companyId }),
  }),
}

export const loader = ({ params }: ActionFunctionArgs) => {
  const { company: companyId } = zx.parseParams(params, {
    company: z.string(),
  })
  return { companyId }
}
