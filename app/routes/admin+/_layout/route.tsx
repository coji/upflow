import type { LoaderFunctionArgs, MetaFunction } from '@remix-run/node'
import { json } from '@remix-run/node'
import { Outlet, useLoaderData } from '@remix-run/react'
import { $path } from 'remix-routes'
import { AppHeader, AppLayout } from '~/app/components'
import { requireAdminUser } from '~/app/features/auth/services/user-session.server'
import { listCompanies } from './queries.server'

export const meta: MetaFunction = () => [{ title: 'Upflow Admin' }]

export const handle = {
  breadcrumb: () => ({ label: 'Admin', to: $path('/admin') }),
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const adminUser = await requireAdminUser(request)
  const companies = await listCompanies()
  return json({ adminUser, companies })
}

const AdminLayoutPage = () => {
  const { adminUser, companies } = useLoaderData<typeof loader>()

  return (
    <AppLayout
      header={<AppHeader companies={companies} isAdmin user={adminUser} />}
    >
      <Outlet />
    </AppLayout>
  )
}
export default AdminLayoutPage
