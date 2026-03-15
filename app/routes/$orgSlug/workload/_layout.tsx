import { Outlet } from 'react-router'
import type { RouteHandle } from '~/app/routes/$orgSlug/_layout'

export const handle: RouteHandle = {
  breadcrumb: (_data: unknown, params?: Record<string, string>) => ({
    label: 'Workload',
    to: `/${params?.orgSlug}/workload`,
  }),
}

export default function WorkloadLayout() {
  return <Outlet />
}
