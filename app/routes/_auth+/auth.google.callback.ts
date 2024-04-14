import { redirect, type LoaderFunctionArgs } from '@remix-run/node'
import { $path } from 'remix-routes'
import {
  authenticator,
  sessionStorage,
} from '~/app/features/auth/services/authenticator.server'

export const loader = async ({ request, context }: LoaderFunctionArgs) => {
  const user = await authenticator.authenticate('google', request, {
    failureRedirect: $path('/login'),
    context,
  })

  // ログイン成功時にセッションを保存
  const session = await sessionStorage.getSession(request.headers.get('cookie'))
  session.set(authenticator.sessionKey, user)
  const headers = new Headers({
    'Set-Cookie': await sessionStorage.commitSession(session),
  })

  return redirect($path('/'), { headers })
}
