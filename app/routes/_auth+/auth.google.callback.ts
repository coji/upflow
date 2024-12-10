import { type LoaderFunctionArgs, redirect } from 'react-router'
import { $path } from 'safe-routes'
import { saveSession } from '~/app/features/auth/services/auth'
import { authenticator } from '~/app/features/auth/services/authenticator.server'

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const user = await authenticator.authenticate('google', request)
  const headers = await saveSession(request, user)
  return redirect($path('/'), { headers })
}
