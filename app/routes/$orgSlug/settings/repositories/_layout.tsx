import type { LoaderFunctionArgs } from 'react-router'
import { Outlet } from 'react-router'
import { requireOrgAdmin } from '~/app/libs/auth.server'

export const handle = {
  breadcrumb: (_data: unknown, params: { orgSlug: string }) => ({
    label: 'Repositories',
    to: `/${params.orgSlug}/settings/repositories`,
  }),
}

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  await requireOrgAdmin(request, params.orgSlug as string)
  return {}
}

export default function RepositoriesLayout() {
  return <Outlet />
}
