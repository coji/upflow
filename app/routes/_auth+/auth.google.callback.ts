import { redirect } from 'react-router'
import { $path } from 'safe-routes'
import { saveSession } from '~/app/features/auth/services/auth'
import { authenticator } from '~/app/features/auth/services/authenticator.server'
import type { Route } from './+types/auth.google.callback'

export const loader = async ({ request }: Route.LoaderArgs) => {
  const user = await authenticator.authenticate('google', request)
  const headers = await saveSession(request, user)
  return redirect($path('/'), { headers })
}
