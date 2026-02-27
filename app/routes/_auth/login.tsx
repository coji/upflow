import { redirect, useSubmit } from 'react-router'
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
import { auth, getSession } from '~/app/libs/auth.server'
import type { Route } from './+types/login'

export const loader = async ({ request }: Route.LoaderArgs) => {
  const session = await getSession(request)
  if (session) {
    throw redirect('/')
  }

  const url = new URL(request.url)
  const error = url.searchParams.get('error')

  const cookieHeader = request.headers.get('Cookie') ?? ''
  const lastProvider =
    cookieHeader
      .split('; ')
      .find((c) => c.startsWith('last_provider='))
      ?.split('=')[1] ?? null

  return { lastProvider, error }
}

export const action = async ({ request }: Route.ActionArgs) => {
  const session = await getSession(request)
  if (session) {
    throw redirect('/')
  }

  const formData = await request.formData()
  const provider = String(formData.get('provider') || 'google')

  const response = await auth.api.signInSocial({
    body: { provider, callbackURL: '/', errorCallbackURL: '/login' },
    asResponse: true,
  })

  if (!response.ok) {
    throw new Response('OAuth sign-in failed', { status: response.status })
  }

  const data = await response.json()
  return redirect(data.url || '/', { headers: response.headers })
}

const errorMessages: Record<string, string> = {
  unable_to_get_user_info:
    'このGitHubアカウントはログインが許可されていません。管理者にお問い合わせください。',
}

export default function LoginPage({
  loaderData: { lastProvider, error },
}: Route.ComponentProps) {
  const submit = useSubmit()

  const handleLogin = (provider: string) => {
    // biome-ignore lint/suspicious/noDocumentCookie: simple cookie for remembering last provider
    document.cookie = `last_provider=${provider}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`
    const formData = new FormData()
    formData.set('provider', provider)
    submit(formData, { method: 'POST' })
  }

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
                  {errorMessages[error] ?? 'ログインに失敗しました。'}
                </AlertDescription>
              </Alert>
            </CardContent>
          )}

          <CardContent className="space-y-3">
            <Button
              className="relative w-full"
              variant="default"
              type="button"
              onClick={() => handleLogin('google')}
            >
              {lastProvider === 'google' && (
                <span className="absolute -top-1 -right-1 flex size-2.5">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-blue-400 opacity-75" />
                  <span className="relative inline-flex size-2.5 rounded-full bg-blue-500" />
                </span>
              )}
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

            <Button
              className="relative w-full"
              variant="outline"
              type="button"
              onClick={() => handleLogin('github')}
            >
              {lastProvider === 'github' && (
                <span className="absolute -top-1 -right-1 flex size-2.5">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-blue-400 opacity-75" />
                  <span className="relative inline-flex size-2.5 rounded-full bg-blue-500" />
                </span>
              )}
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
              GitHubでログイン
            </Button>
          </CardContent>
        </Card>
      </Center>
    </AppLayout>
  )
}
