import { Outlet, href } from 'react-router'

export const handle = {
  breadcrumb: (_data: unknown, params: { orgSlug: string }) => ({
    label: 'Repositories',
    to: href('/:orgSlug/settings/repositories', { orgSlug: params.orgSlug }),
  }),
}

export default function RepositoriesLayout() {
  return <Outlet />
}
