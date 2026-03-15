import { Outlet } from 'react-router'
import type { RouteHandle } from '~/app/routes/$orgSlug/_layout'

export const handle: RouteHandle = {
  breadcrumb: (_data: unknown, params?: Record<string, string>) => ({
    label: 'Analysis',
    to: `/${params?.orgSlug}/analysis/reviews`,
  }),
}

export default function AnalysisLayout() {
  return <Outlet />
}
