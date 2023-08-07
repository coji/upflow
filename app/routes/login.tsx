import { json, type LoaderArgs, type V2_MetaFunction } from '@remix-run/node'
import { useLoaderData } from '@remix-run/react'
import { AppAlert, AppCenterFormFrame } from '~/app/components'
import { Stack } from '~/app/components/ui'
import { GoogleLoginButton } from '~/app/features/auth/components/GoogleLoginButton'
import { authenticator, sessionStorage } from '~/app/features/auth/services/authenticator.server'

export const meta: V2_MetaFunction = () => [{ title: 'Login - UpFlow' }]

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
    <div className="grid min-h-screen grid-rows-[1fr_auto] bg-gray-100">
      <AppCenterFormFrame title="UpFlow" subtitle="ログイン">
        <Stack>
          <GoogleLoginButton className="mt-8 w-full" variant="default">
            Googleアカウントで登録 / ログイン
          </GoogleLoginButton>

          {errorMessage && (
            <AppAlert status="error">
              <div className="font-bold">ログインができません</div>
              <div>{errorMessage}</div>
            </AppAlert>
          )}
        </Stack>
      </AppCenterFormFrame>

      <footer className="bg-background py-4 text-center">Copyright &copy; TechTalk Inc.</footer>
    </div>
  )
}
