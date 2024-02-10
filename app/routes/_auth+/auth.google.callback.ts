import { redirect, type LoaderFunctionArgs } from '@remix-run/node'
import {
  authenticator,
  sessionStorage,
} from '~/app/features/auth/services/authenticator.server'

export const loader = async ({ request, context }: LoaderFunctionArgs) => {
  const user = await authenticator.authenticate('google', request, {
    failureRedirect: '/login',
    context,
  })

  // ログイン成功時にセッションを保存
  const session = await sessionStorage.getSession(request.headers.get('cookie'))
  session.set(authenticator.sessionKey, user)
  const headers = new Headers({
    'Set-Cookie': await sessionStorage.commitSession(session),
  })

  // admin なら管理画面に、一般ユーザはダッシュボードにリダイレクト
  if (user.role === 'admin') {
    return redirect('/admin', { headers })
  }
  return redirect('/', { headers })
}
