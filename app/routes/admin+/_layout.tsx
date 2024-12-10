import type { LoaderFunctionArgs } from 'react-router'
import { Outlet, useLoaderData } from 'react-router'
import { $path } from 'safe-routes'
import { AppHeader, AppLayout } from '~/app/components'
import { requireAdminUser } from '~/app/features/auth/services/auth'

export const meta = () => [{ title: 'Upflow Admin' }]

export const handle = {
  breadcrumb: () => ({ label: 'Admin', to: $path('/admin') }),
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const adminUser = await requireAdminUser(request)
  return { adminUser }
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
