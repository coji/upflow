import { redirect } from 'react-router'
import { AppLayout } from '~/app/components'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Center,
  Stack,
} from '~/app/components/ui'
import { GoogleLoginButton } from '~/app/features/auth/components/GoogleLoginButton'
import { getSessionUser } from '~/app/features/auth/services/auth'
import type { Route } from './+types/login'

export const loader = async ({ request }: Route.LoaderArgs) => {
  // 認証済みならトップページにリダイレクト
  const user = await getSessionUser(request)
  if (user) {
    throw redirect('/')
  }
  return
}

export default function LoginPage() {
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

              {/* {errorMessage && (
                <Alert>
                  <AlertTitle>ログインができません</AlertTitle>
                  <AlertDescription>{errorMessage}</AlertDescription>
                </Alert>
              )} */}
            </Stack>
          </CardContent>
        </Card>
      </Center>
    </AppLayout>
  )
}
