import { Outlet, href } from 'react-router'
import { AppHeader, AppLayout } from '~/app/components'
import { requireSuperAdmin } from '~/app/libs/auth.server'
import type { Route } from './+types/_layout'

export const meta = () => [{ title: 'Upflow Admin' }]

export const handle = {
  breadcrumb: () => ({ label: 'Admin', to: href('/admin') }),
}

export const loader = async ({ request }: Route.LoaderArgs) => {
  await requireSuperAdmin(request)
}

const AdminLayoutPage = () => {
  return (
    <AppLayout header={<AppHeader isAdmin />}>
      <Outlet />
    </AppLayout>
  )
}
export default AdminLayoutPage
