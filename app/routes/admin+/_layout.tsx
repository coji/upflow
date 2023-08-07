import { json, type LoaderArgs } from '@remix-run/node'
import { Outlet, useLoaderData } from '@remix-run/react'
import { AppLayout } from '~/app/components'
import { getAdminUser } from '~/app/features/auth/services/user-session.server'

export const loader = async ({ request }: LoaderArgs) => {
  const adminUser = await getAdminUser(request)
  return json({ adminUser })
}

const AdminLayoutPage = () => {
  const { adminUser } = useLoaderData<typeof loader>()
  return (
    <AppLayout user={adminUser}>
      <Outlet />
    </AppLayout>
  )
}
export default AdminLayoutPage
