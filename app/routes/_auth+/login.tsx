import { json, type LoaderArgs } from '@remix-run/node'
import { useLoaderData } from '@remix-run/react'
import { AppLayout } from '~/app/components'
import { Alert, AlertDescription, AlertTitle, Center, Heading, Stack } from '~/app/components/ui'
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
      <Center>
        <div className="rounded bg-primary-foreground px-16 py-8 text-center shadow md:w-auto">
          <Heading>
            <p className="text-2xl">UpFlow</p>
            <p className="text-sm font-normal">ログイン</p>
          </Heading>

          <Stack>
            <GoogleLoginButton className="mt-8 w-full" variant="default">
              Googleでログイン
            </GoogleLoginButton>

            {errorMessage && (
              <Alert>
                <AlertTitle>ログインができません</AlertTitle>
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            )}
          </Stack>
        </div>
      </Center>
    </AppLayout>
  )
}
