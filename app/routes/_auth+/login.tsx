import { redirect } from 'react-router'
import { AppLayout } from '~/app/components'
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Center,
  Stack,
} from '~/app/components/ui'
import { authClient } from '~/app/libs/auth-client'
import { getSession } from '~/app/libs/auth.server'
import type { Route } from './+types/login'

export const loader = async ({ request }: Route.LoaderArgs) => {
  // 認証済みならトップページにリダイレクト
  const session = await getSession(request)
  if (session) {
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
              <Button
                className="w-full"
                variant="default"
                type="button"
                onClick={() => {
                  authClient.signIn.social({ provider: 'google' })
                }}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                >
                  <title>Google</title>
                  <path
                    fill="currentColor"
                    d="M3.064 7.51A9.996 9.996 0 0 1 12 2c2.695 0 4.959.991 6.69 2.605l-2.867 2.868C14.786 6.482 13.468 5.977 12 5.977c-2.605 0-4.81 1.76-5.595 4.123c-.2.6-.314 1.24-.314 1.9c0 .66.114 1.3.314 1.9c.786 2.364 2.99 4.123 5.595 4.123c1.345 0 2.49-.355 3.386-.955a4.6 4.6 0 0 0 1.996-3.018H12v-3.868h9.418c.118.654.182 1.336.182 2.045c0 3.046-1.09 5.61-2.982 7.35C16.964 21.105 14.7 22 12 22A9.996 9.996 0 0 1 2 12c0-1.614.386-3.14 1.064-4.49Z"
                  />
                </svg>
                Googleでログイン
              </Button>
            </Stack>
          </CardContent>
        </Card>
      </Center>
    </AppLayout>
  )
}
