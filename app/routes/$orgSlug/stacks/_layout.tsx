import { Outlet } from 'react-router'
import type { RouteHandle } from '~/app/routes/$orgSlug/_layout'

export const handle: RouteHandle = {
  breadcrumb: (_data: unknown, params?: Record<string, string>) => ({
    label: 'Review Stacks',
    to: `/${params?.orgSlug}/stacks`,
  }),
}

export default function StacksLayout() {
  return <Outlet />
}
