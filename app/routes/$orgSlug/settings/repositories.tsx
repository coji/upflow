import type { LoaderFunctionArgs } from 'react-router'
import { requireOrgAdmin } from '~/app/libs/auth.server'

export const handle = {
  breadcrumb: ({ organization }: Awaited<ReturnType<typeof loader>>) => ({
    label: 'Repositories',
    to: `/${organization.slug}/settings/repositories`,
  }),
}

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { organization } = await requireOrgAdmin(
    request,
    params.orgSlug as string,
  )
  return { organization }
}
