import type { LoaderFunctionArgs } from '@remix-run/node'
import { Outlet, useLoaderData } from '@remix-run/react'
import { $path } from 'remix-routes'
import { AppHeader, AppLayout } from '~/app/components'
import { requireUser } from '~/app/features/auth/services/user-session.server'
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
