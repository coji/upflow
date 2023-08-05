import { getUser } from '~/app/features/auth/services/user-session.server'
import { json, type LoaderArgs } from '@remix-run/node'
import { useLoaderData } from '@remix-run/react'
import { Center } from '@chakra-ui/react'

export const loader = async ({ request }: LoaderArgs) => {
  const user = await getUser(request)
  return json({ user })
}

export default function DashboardIndex() {
  const { user } = useLoaderData<typeof loader>()
  if (user.role === 'admin') {
    return <Center h="full">Select a company from the left menu.</Center>
  }

  return <div>{user.displayName}</div>
}
