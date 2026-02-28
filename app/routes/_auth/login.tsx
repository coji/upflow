import { redirect } from 'react-router'
import { AppLayout } from '~/app/components'
import {
  Alert,
  AlertDescription,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Center,
} from '~/app/components/ui'
import { auth, getSession, safeRedirectTo } from '~/app/libs/auth.server'
import type { Route } from './+types/login'

export const loader = async ({ request }: Route.LoaderArgs) => {
  const url = new URL(request.url)
  const redirectTo = safeRedirectTo(url.searchParams.get('redirectTo'))
  const error = url.searchParams.get('error')

  const session = await getSession(request)
  if (session) {
    throw redirect(redirectTo.startsWith('/login') ? '/' : redirectTo)
  }

  return { error, redirectTo }
}

export const action = async ({ request }: Route.ActionArgs) => {
  const session = await getSession(request)
  if (session) {
    throw redirect('/')
  }

  const formData = await request.formData()
  const rawRedirectTo = safeRedirectTo(
    formData.get('redirectTo') as string | null,
  )
  const redirectTo = rawRedirectTo.startsWith('/login') ? '/' : rawRedirectTo

  const response = await auth.api.signInSocial({
    body: {
      provider: 'github',
      callbackURL: redirectTo,
      errorCallbackURL: `/login?redirectTo=${encodeURIComponent(redirectTo)}`,
    },
    asResponse: true,
  })

  if (!response.ok) {
    throw new Response('OAuth sign-in failed', { status: response.status })
  }

  const data = await response.json()
  return redirect(data.url || redirectTo, { headers: response.headers })
}

const errorMessages: Record<string, string> = {
  unable_to_get_user_info:
    'This GitHub account is not authorized to sign in. Please ask an administrator to enable access.',
}

export default function LoginPage({
  loaderData: { error, redirectTo },
}: Route.ComponentProps) {
  return (
    <AppLayout>
      <Center>
        <Card>
          <CardHeader className="text-center">
            <CardTitle>UpFlow</CardTitle>
          </CardHeader>

          {error && (
            <CardContent className="pb-0">
              <Alert variant="destructive">
                <AlertDescription>
                  {errorMessages[error] ?? 'Sign in failed.'}
                </AlertDescription>
              </Alert>
            </CardContent>
          )}

          <CardContent>
            <form method="POST">
              <input type="hidden" name="redirectTo" value={redirectTo} />
              <Button className="w-full" variant="default" type="submit">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                >
                  <title>GitHub</title>
                  <path
                    fill="currentColor"
                    d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49c.5.092.682-.217.682-.482c0-.237-.008-.866-.013-1.7c-2.782.604-3.369-1.34-3.369-1.34c-.454-1.156-1.11-1.464-1.11-1.464c-.908-.62.069-.608.069-.608c1.003.07 1.531 1.03 1.531 1.03c.892 1.529 2.341 1.087 2.91.832c.092-.647.35-1.088.636-1.338c-2.22-.253-4.555-1.11-4.555-4.943c0-1.091.39-1.984 1.029-2.683c-.103-.253-.446-1.27.098-2.647c0 0 .84-.269 2.75 1.025A9.578 9.578 0 0 1 12 6.836a9.59 9.59 0 0 1 2.504.337c1.909-1.294 2.747-1.025 2.747-1.025c.546 1.377.203 2.394.1 2.647c.64.699 1.028 1.592 1.028 2.683c0 3.842-2.339 4.687-4.566 4.935c.359.309.678.919.678 1.852c0 1.336-.012 2.415-.012 2.743c0 .267.18.578.688.48C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10Z"
                  />
                </svg>
                Sign in with GitHub
              </Button>
            </form>
          </CardContent>
        </Card>
      </Center>
    </AppLayout>
  )
}
