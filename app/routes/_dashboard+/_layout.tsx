import { json, type LoaderFunctionArgs } from '@remix-run/node'
import { Outlet, useLoaderData } from '@remix-run/react'
import { AppLayout } from '~/app/components'
import { requireUser } from '~/app/features/auth/services/user-session.server'
import { listCompanies } from '~/app/models/admin/company.server'

export const handle = {
  breadcrumb: () => ({ label: 'Dashboard', to: '/' }),
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const user = await requireUser(request)
  const companies = await listCompanies()
  return json({ user, companies })
}

const DashboardLayoutPage = () => {
  const { user, companies } = useLoaderData<typeof loader>()
  return (
    <AppLayout user={user} companies={companies}>
      <Outlet />
    </AppLayout>
  )
}
export default DashboardLayoutPage
