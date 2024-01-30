import { type LoaderFunctionArgs, json } from '@remix-run/node'
import { useLoaderData } from '@remix-run/react'
import { Center } from '~/app/components/ui'
import { requireUser } from '~/app/features/auth/services/user-session.server'

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const user = await requireUser(request)
  return json({ user })
}

export default function DashboardIndex() {
  const { user } = useLoaderData<typeof loader>()
  if (user.role === 'admin') {
    return <Center>Select a company from the left menu.</Center>
  }

  return <div>{user.displayName}</div>
}
