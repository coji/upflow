import type { LoaderArgs } from '@remix-run/node'
import { json, redirect } from '@remix-run/node'
import { getCompaniesByUser } from '~/app/models/company.server'
import { getUser } from '~/app/utils/session.server'

export const loader = async ({ request, params, context }: LoaderArgs) => {
  const user = await getUser(request)
  if (!user) {
    return redirect('/')
  }
  const companies = await getCompaniesByUser(user.id)
  return json({ companies, me: user })
}
