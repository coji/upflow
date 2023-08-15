import { json, type LoaderArgs, type V2_MetaFunction } from '@remix-run/node'
import { Outlet, useLoaderData } from '@remix-run/react'
import { AppLayout } from '~/app/components'
import { getAdminUser } from '~/app/features/auth/services/user-session.server'
import { listCompanies } from '~/app/models/admin/company.server'

export const meta: V2_MetaFunction = () => [{ title: 'Upflow Admin' }]

export const handle = {
  breadcrumb: () => ({ label: 'Admin', to: `/admin` }),
}

export const loader = async ({ request }: LoaderArgs) => {
  const adminUser = await getAdminUser(request)
  const companies = await listCompanies()
  return json({ adminUser, companies })
}

const AdminLayoutPage = () => {
  const { adminUser, companies } = useLoaderData<typeof loader>()

  return (
    <AppLayout user={adminUser} companies={companies}>
      <Outlet />
    </AppLayout>
  )
}
export default AdminLayoutPage
