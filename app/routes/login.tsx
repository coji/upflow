import { Box, Stack } from '@chakra-ui/react'
import type { LoaderArgs, V2_MetaFunction } from '@remix-run/node'
import { json } from '@remix-run/node'
import { useLoaderData } from '@remix-run/react'
import { AppCenterFormFrame, AppAlert } from '~/app/components'
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
    <Box display="flex" flexDirection="column" bgColor="gray.100" minH="100vh">
      <AppCenterFormFrame title="UpFlow" subtitle="ログイン">
        <Stack>
          <GoogleLoginButton w="full" mt="8">
            Googleアカウントで登録 / ログイン
          </GoogleLoginButton>

          {errorMessage && (
            <AppAlert status="error">
              <Box fontWeight="bold">ログインができません</Box>
              <Box>{errorMessage}</Box>
            </AppAlert>
          )}
        </Stack>
      </AppCenterFormFrame>

      <Box as="footer" textAlign="center" bgColor="white" py="4">
        Copyright &copy; TechTalk Inc.
      </Box>
    </Box>
  )
}
