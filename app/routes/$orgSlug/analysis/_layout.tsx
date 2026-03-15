import { Outlet, href } from 'react-router'
import type { RouteHandle } from '~/app/routes/$orgSlug/_layout'

export const handle: RouteHandle = {
  breadcrumb: (_data: unknown, params?: Record<string, string>) => ({
    label: 'Analysis',
    to: href('/:orgSlug/analysis/reviews', { orgSlug: params?.orgSlug ?? '' }),
  }),
}

export default function AnalysisLayout() {
  return <Outlet />
}
