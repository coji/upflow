import type { LoaderArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import { Outlet, useLoaderData } from '@remix-run/react'
import { AppLayout } from '~/app/components'
import { getUser } from '~/app/features/auth/services/user-session.server'

export const loader = async ({ request }: LoaderArgs) => {
  const user = await getUser(request)
  return json({ user })
}

const DashboardLayoutPage = () => {
  const { user } = useLoaderData<typeof loader>()
  return (
    <AppLayout user={user}>
      <Outlet />
    </AppLayout>
  )
}
export default DashboardLayoutPage
