import { json, type LoaderFunctionArgs } from '@remix-run/node'
import { Outlet, useLoaderData } from '@remix-run/react'
import { $path } from 'remix-routes'
import { AppHeader, AppLayout } from '~/app/components'
import { requireUser } from '~/app/features/auth/services/user-session.server'
import { useBreadcrumbs } from '~/app/hooks/AppBreadcrumbs'
import { listCompanies } from './queries.server'

export const handle = {
  breadcrumb: () => ({ label: 'Dashboard', to: $path('/') }),
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const user = await requireUser(request)
  const companies = await listCompanies()
  return json({ user, companies })
}

const DashboardLayoutPage = () => {
  const { user, companies } = useLoaderData<typeof loader>()
  const { AppBreadcrumbs } = useBreadcrumbs()

  return (
    <AppLayout
      header={<AppHeader user={user} companies={companies} />}
      breadcrumbs={<AppBreadcrumbs />}
    >
      <Outlet />
    </AppLayout>
  )
}
export default DashboardLayoutPage
