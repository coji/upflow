import { json, type LoaderFunctionArgs, type MetaFunction } from '@remix-run/node'
import { Outlet, useLoaderData } from '@remix-run/react'
import { AppLayout } from '~/app/components'
import { requireAdminUser } from '~/app/features/auth/services/user-session.server'
import { listCompanies } from '~/app/models/admin/company.server'

export const meta: MetaFunction = () => [{ title: 'Upflow Admin' }]

export const handle = {
  breadcrumb: () => ({ label: 'Admin', to: '/admin' }),
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const adminUser = await requireAdminUser(request)
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
