import { type LoaderFunctionArgs, unstable_data } from '@remix-run/node'
import { useLoaderData } from '@remix-run/react'
import { $path } from 'remix-routes'
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
  await authenticator.isAuthenticated(request, { successRedirect: $path('/') })

  // ログイン時のエラーメッセージがもしあればそれを表示する
  const session = await sessionStorage.getSession(
    request.headers.get('Cookie') || '',
  )
  const error = session.get(authenticator.sessionErrorKey) as
    | { message: string }
    | undefined

  const headers = new Headers()
  headers.set('Set-Cookie', await sessionStorage.commitSession(session))

  return unstable_data({ errorMessage: error?.message }, { headers })
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
