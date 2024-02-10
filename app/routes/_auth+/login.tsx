import { json, type LoaderFunctionArgs } from '@remix-run/node'
import { useLoaderData } from '@remix-run/react'
import { AppLayout } from '~/app/components'
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Center,
  Stack,
} from '~/app/components/ui'
import { GoogleLoginButton } from '~/app/features/auth/components/GoogleLoginButton'
import {
  authenticator,
  sessionStorage,
} from '~/app/features/auth/services/authenticator.server'

export const loader = async ({ request }: LoaderFunctionArgs) => {
  // 認証済みならトップページにリダイレクト
  await authenticator.isAuthenticated(request, { successRedirect: '/admin' })

  // ログイン時のエラーメッセージがもしあればそれを表示する
  const session = await sessionStorage.getSession(
    request.headers.get('Cookie') || '',
  )
  const error = session.get(authenticator.sessionErrorKey) as
    | { message: string }
    | undefined

  return json(
    { errorMessage: error?.message },
    {
      headers: new Headers({
        'Set-Cookie': await sessionStorage.commitSession(session),
      }),
    }, // flash messageを削除するためにセッションを更新
  )
}

export default function LoginPage() {
  const { errorMessage } = useLoaderData<typeof loader>()

  return (
    <AppLayout>
      <Center>
        <Card>
          <CardHeader className="text-center">
            <CardTitle>UpFlow</CardTitle>
          </CardHeader>

          <CardContent>
            <Stack>
              <GoogleLoginButton className="w-full" variant="default">
                Googleでログイン
              </GoogleLoginButton>

              {errorMessage && (
                <Alert>
                  <AlertTitle>ログインができません</AlertTitle>
                  <AlertDescription>{errorMessage}</AlertDescription>
                </Alert>
              )}
            </Stack>
          </CardContent>
        </Card>
      </Center>
    </AppLayout>
  )
}
