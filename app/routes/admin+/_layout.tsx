import type { LoaderFunctionArgs, MetaFunction } from '@remix-run/node'
import { json } from '@remix-run/node'
import { Outlet, useLoaderData } from '@remix-run/react'
import { $path } from 'remix-routes'
import { AppHeader, AppLayout } from '~/app/components'
import { requireAdminUser } from '~/app/features/auth/services/user-session.server'

export const meta: MetaFunction = () => [{ title: 'Upflow Admin' }]

export const handle = {
  breadcrumb: () => ({ label: 'Admin', to: $path('/admin') }),
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const adminUser = await requireAdminUser(request)
  return json({ adminUser })
}

const AdminLayoutPage = () => {
  const { adminUser } = useLoaderData<typeof loader>()

  return (
    <AppLayout header={<AppHeader isAdmin user={adminUser} />}>
      <Outlet />
    </AppLayout>
  )
}
export default AdminLayoutPage
