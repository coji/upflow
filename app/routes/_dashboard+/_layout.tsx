import type { LoaderArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import { Outlet, useLoaderData } from '@remix-run/react'
import { AppLayout } from '~/app/components'
import { getUser } from '~/app/features/auth/services/user-session.server'
import { listCompanies } from '~/app/models/admin/company.server'

export const handle = {
  breadcrumb: () => ({ label: 'Dashboard', to: `/` }),
}

export const loader = async ({ request }: LoaderArgs) => {
  const user = await getUser(request)
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
