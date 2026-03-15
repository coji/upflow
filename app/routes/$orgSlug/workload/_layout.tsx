import { Outlet, href } from 'react-router'
import type { RouteHandle } from '~/app/routes/$orgSlug/_layout'

export const handle: RouteHandle = {
  breadcrumb: (_data: unknown, params?: Record<string, string>) => ({
    label: 'Workload',
    to: href('/:orgSlug/workload', { orgSlug: params?.orgSlug ?? '' }),
  }),
}

export default function WorkloadLayout() {
  return <Outlet />
}
