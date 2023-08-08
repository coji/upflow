import { json, type LoaderArgs } from '@remix-run/node'
import { useLoaderData } from '@remix-run/react'
import { AppAlert, AppCenterFormFrame, AppLayout } from '~/app/components'
import { Stack } from '~/app/components/ui'
import { GoogleLoginButton } from '~/app/features/auth/components/GoogleLoginButton'
import { authenticator, sessionStorage } from '~/app/features/auth/services/authenticator.server'

export const loader = async ({ request }: LoaderArgs) => {
  // 認証済みならトップページにリダイレクト
  await authenticator.isAuthenticated(request, { successRedirect: '/admin' })

  // ログイン時のエラーメッセージがもしあればそれを表示する
  const session = await sessionStorage.getSession(request.headers.get('Cookie') || '')
  const error = session.get(authenticator.sessionErrorKey) as { message: string } | undefined

  return json(
    { errorMessage: error?.message },
    { headers: new Headers({ 'Set-Cookie': await sessionStorage.commitSession(session) }) }, // flash messageを削除するためにセッションを更新
  )
}

export default function LoginPage() {
  const { errorMessage } = useLoaderData<typeof loader>()

  return (
    <AppLayout>
      <AppCenterFormFrame title="UpFlow" subtitle="ログイン">
        <Stack>
          <GoogleLoginButton className="mt-8 w-full" variant="default">
            Googleアカウントで続ける
          </GoogleLoginButton>

          {errorMessage && (
            <AppAlert status="error">
              <div className="font-bold">ログインができません</div>
              <div>{errorMessage}</div>
            </AppAlert>
          )}
        </Stack>
      </AppCenterFormFrame>
    </AppLayout>
  )
}
