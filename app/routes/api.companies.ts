import type { LoaderArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import { getCompaniesByUser } from '~/app/models/company.server'
import { getUser } from '~/app/features/auth/services/user-session.server'

export const loader = async ({ request, params, context }: LoaderArgs) => {
  const user = await getUser(request)
  const companies = await getCompaniesByUser(user.id)
  return json({ companies, me: user })
}
