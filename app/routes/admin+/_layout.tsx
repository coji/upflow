import { json, type LoaderArgs } from '@remix-run/node'
import { Outlet, useLoaderData } from '@remix-run/react'
import { AppBreadcrumbs, AppLayout, useBreadcrumbs } from '~/app/components'
import { getAdminUser } from '~/app/features/auth/services/user-session.server'
import { listCompanies } from '~/app/models/admin/company.server'

export const handle = {
  breadcrumb: () => ({
    label: 'Admin',
    to: `/admin`,
  }),
}

export const loader = async ({ request }: LoaderArgs) => {
  const adminUser = await getAdminUser(request)
  const companies = await listCompanies()

  return json({
    adminUser,
    companies: companies.map((company) => {
      return {
        id: company.id,
        name: company.name,
        teams: company.teams.map((team) => {
          return {
            id: team.id,
            name: team.name,
          }
        }),
      }
    }),
  })
}

const AdminLayoutPage = () => {
  const { adminUser, companies } = useLoaderData<typeof loader>()
  const breadcrumbs = useBreadcrumbs()

  return (
    <AppLayout user={adminUser} companies={companies}>
      <AppBreadcrumbs items={breadcrumbs} />
      <Outlet />
    </AppLayout>
  )
}
export default AdminLayoutPage
