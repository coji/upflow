import { json, type LoaderArgs } from '@remix-run/node'
import { useLoaderData } from '@remix-run/react'
import { Center } from '~/app/components/ui'
import { getUser } from '~/app/features/auth/services/user-session.server'

export const loader = async ({ request }: LoaderArgs) => {
  const user = await getUser(request)
  return json({ user })
}

export default function DashboardIndex() {
  const { user } = useLoaderData<typeof loader>()
  if (user.role === 'admin') {
    return <Center>Select a company from the left menu.</Center>
  }

  return <div>{user.displayName}</div>
}
