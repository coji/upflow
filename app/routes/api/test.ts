import type { LoaderArgs } from '@remix-run/server-runtime'
import { json, redirect } from '@remix-run/server-runtime'
import { getCompaniesByUser } from '~/app/models/company.server'
import { getUser } from '~/app/session.server'

export const loader = async ({ request, params, context }: LoaderArgs) => {
  const user = await getUser(request)
  if (!user) {
    return redirect('/')
  }
  const companies = await getCompaniesByUser(user.id)
  return json({ companies, me: user })
}
