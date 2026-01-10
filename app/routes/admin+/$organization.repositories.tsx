import { zx } from '@coji/zodix/v4'
import type { ActionFunctionArgs } from 'react-router'
import { href } from 'react-router'
import { z } from 'zod'

export const handle = {
  breadcrumb: ({ organizationId }: { organizationId: string }) => ({
    label: 'Repositories',
    to: href('/admin/:organization/repositories', {
      organization: organizationId,
    }),
  }),
}

export const loader = ({ params }: ActionFunctionArgs) => {
  const { organization: organizationId } = zx.parseParams(params, {
    organization: z.string(),
  })
  return { organizationId }
}
