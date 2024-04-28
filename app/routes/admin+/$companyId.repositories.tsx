import type { LoaderFunctionArgs } from '@remix-run/node'
import { $path } from 'remix-routes'
import { z } from 'zod'
import { zx } from 'zodix'

export const handle = {
  breadcrumb: ({ companyId }: { companyId: string }) => ({
    label: 'Repositories',
    to: $path('/admin/:companyId/repositories', { companyId }),
  }),
}

export const loader = ({ params }: LoaderFunctionArgs) => {
  const { companyId } = zx.parseParams(params, { companyId: z.string() })
  return { companyId }
}
