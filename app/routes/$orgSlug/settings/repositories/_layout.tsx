import { Outlet } from 'react-router'

export const handle = {
  breadcrumb: (_data: unknown, params: { orgSlug: string }) => ({
    label: 'Repositories',
    to: `/${params.orgSlug}/settings/repositories`,
  }),
}

export default function RepositoriesLayout() {
  return <Outlet />
}
