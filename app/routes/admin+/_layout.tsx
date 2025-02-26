import { Outlet } from 'react-router'
import { $path } from 'safe-routes'
import { AppHeader, AppLayout } from '~/app/components'
import { requireAdminUser } from '~/app/features/auth/services/auth'
import type { Route } from './+types/_layout'

export const meta = () => [{ title: 'Upflow Admin' }]

export const handle = {
  breadcrumb: () => ({ label: 'Admin', to: $path('/admin') }),
}

export const loader = async ({ request }: Route.LoaderArgs) => {
  const adminUser = await requireAdminUser(request)
  return { adminUser }
}

const AdminLayoutPage = ({
  loaderData: { adminUser },
}: Route.ComponentProps) => {
  return (
    <AppLayout header={<AppHeader isAdmin user={adminUser} />}>
      <Outlet />
    </AppLayout>
  )
}
export default AdminLayoutPage
