import { Outlet, href } from 'react-router'
import { AppHeader, AppLayout } from '~/app/components'
import { superAdminMiddleware } from '~/app/middleware/super-admin'

export const meta = () => [{ title: 'Upflow Admin' }]

export const handle = {
  breadcrumb: () => ({ label: 'Admin', to: href('/admin') }),
}

export const middleware = [superAdminMiddleware]

const AdminLayoutPage = () => {
  return (
    <AppLayout header={<AppHeader isAdmin />}>
      <Outlet />
    </AppLayout>
  )
}
export default AdminLayoutPage
