import { redirect } from 'react-router'
import { getFirstOrganization, getSession } from '~/app/libs/auth.server'
import type { Route } from './+types/_index'

export const loader = async ({ request }: Route.LoaderArgs) => {
  const session = await getSession(request)
  if (!session) {
    throw redirect('/login')
  }

  const firstOrg = await getFirstOrganization(session.user.id)
  if (firstOrg) {
    throw redirect(`/${firstOrg.slug}`)
  }

  throw redirect('/no-org')
}
