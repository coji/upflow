import type { LoaderFunctionArgs } from 'react-router'
import { Outlet, useLoaderData } from 'react-router'
import { $path } from 'safe-routes'
import { AppHeader, AppLayout } from '~/app/components'
import { requireUser } from '~/app/features/auth/services/auth'
import { useBreadcrumbs } from '~/app/hooks/AppBreadcrumbs'

export const handle = {
  breadcrumb: () => ({ label: 'Dashboard', to: $path('/') }),
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const user = await requireUser(request)
  return { user }
}

const DashboardLayoutPage = () => {
  const { user } = useLoaderData<typeof loader>()
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
export default DashboardLayoutPage
