import { Outlet } from 'react-router'
import type { RouteHandle } from '~/app/routes/$orgSlug/_layout'

export const handle: RouteHandle = {
  breadcrumb: (_data: unknown, params?: Record<string, string>) => ({
    label: 'Throughput',
    to: `/${params?.orgSlug}/throughput/merged`,
  }),
}

export default function ThroughputLayout() {
  return <Outlet />
}
