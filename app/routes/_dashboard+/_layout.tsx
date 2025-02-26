import { Outlet, href } from 'react-router'
import { AppHeader, AppLayout } from '~/app/components'
import { requireUser } from '~/app/features/auth/services/auth'
import { useBreadcrumbs } from '~/app/hooks/AppBreadcrumbs'
import type { Route } from './+types/_layout'

export const handle = {
  breadcrumb: () => ({ label: 'Dashboard', to: href('/') }),
}

export const loader = async ({ request }: Route.LoaderArgs) => {
  const user = await requireUser(request)
  return { user }
}

export default function DashboardLayoutPage({
  loaderData: { user },
}: Route.ComponentProps) {
  const { AppBreadcrumbs } = useBreadcrumbs()

  return (
    <AppLayout
      header={<AppHeader user={user} />}
      breadcrumbs={<AppBreadcrumbs />}
    >
      <Outlet />
    </AppLayout>
  )
}
