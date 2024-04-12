import { json, type LoaderFunctionArgs } from '@remix-run/node'
import { requireUser } from '~/app/features/auth/services/user-session.server'

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const user = await requireUser(request)
  return json({ user })
}

export default function DashboardIndex() {
  return <div />
}
