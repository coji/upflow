import { unstable_defineLoader as defineLoader } from '@remix-run/node'
import { $path } from 'remix-routes'
import { z } from 'zod'
import { zx } from 'zodix'

export const handle = {
  breadcrumb: ({ companyId }: { companyId: string }) => ({
    label: 'Repositories',
    to: $path('/admin/:company/repositories', { company: companyId }),
  }),
}

export const loader = defineLoader(({ params }) => {
  const { company: companyId } = zx.parseParams(params, { company: z.string() })
  return { companyId }
})
