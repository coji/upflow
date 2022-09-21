import { Box, Button, Checkbox, FormControl, FormErrorMessage, FormLabel, Input, Stack } from '@chakra-ui/react'
import type { ActionArgs, LoaderArgs, MetaFunction } from '@remix-run/node'
import { json, redirect } from '@remix-run/node'
import { Form, useActionData, useSearchParams } from '@remix-run/react'
import { useEffect, useRef } from 'react'
import { verifyLogin } from '~/app/models/user.server'
import { createUserSession, getUser } from '~/app/utils/session.server'
import { safeRedirect, validateEmail } from '~/app/utils/utils'
import { AppCenterFormFrame } from '../components/AppCenterFormFrame'

export const loader = async ({ request }: LoaderArgs) => {
  const userId = await getUser(request)
  if (userId) return redirect('/')
  return json({})
}

interface ActionData {
  errors?: {
    email?: string
    password?: string
  }
}

export const action = async ({ request }: ActionArgs) => {
  const formData = await request.formData()
  const email = formData.get('email')
  const password = formData.get('password')
  const redirectTo = safeRedirect(formData.get('redirectTo'), '/')
  const remember = formData.get('remember')

  if (!validateEmail(email)) {
    return json<ActionData>({ errors: { email: 'Email is invalid' } }, { status: 400 })
  }

  if (typeof password !== 'string' || password.length === 0) {
    return json<ActionData>({ errors: { password: 'Password is required' } }, { status: 400 })
  }

  if (password.length < 8) {
    return json<ActionData>({ errors: { password: 'Password is too short' } }, { status: 400 })
  }

  const user = await verifyLogin(email, password)

  if (!user) {
    return json<ActionData>({ errors: { email: 'Invalid email or password' } }, { status: 400 })
  }

  return createUserSession({
    request,
    userId: user.id,
    remember: remember === 'on' ? true : false,
    redirectTo
  })
}

export const meta: MetaFunction = () => {
  return {
    title: 'Login - UpFlow'
  }
}

export default function LoginPage() {
  const [searchParams] = useSearchParams()
  const redirectTo = searchParams.get('redirectTo') || '/'
  const actionData = useActionData<typeof action>()
  const emailRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (actionData?.errors?.email) {
      emailRef.current?.focus()
    } else if (actionData?.errors?.password) {
      passwordRef.current?.focus()
    }
  }, [actionData])

  return (
    <Box display="flex" flexDirection="column" bgColor="gray.100" minH="100vh">
      <AppCenterFormFrame title="UpFlow" subtitle="ログイン">
        <Form method="post" noValidate>
          <Stack>
            <FormControl isInvalid={!!actionData?.errors?.email}>
              <FormLabel htmlFor="email" fontSize="sm" color="gray.600">
                Eメール
              </FormLabel>
              <Input
                ref={emailRef}
                id="email"
                required
                autoFocus={true}
                name="email"
                type="email"
                autoComplete="email"
                aria-invalid={actionData?.errors?.email ? true : undefined}
                aria-describedby="email-error"
              />
              {actionData?.errors?.email && (
                <FormErrorMessage id="email-error">{actionData.errors.email}</FormErrorMessage>
              )}
            </FormControl>

            <FormControl isInvalid={!!actionData?.errors?.password}>
              <FormLabel htmlFor="password" fontSize="sm" color="gray.600">
                パスワード
              </FormLabel>
              <Input
                id="password"
                ref={passwordRef}
                name="password"
                type="password"
                autoComplete="current-password"
                aria-invalid={actionData?.errors?.password ? true : undefined}
                aria-describedby="password-error"
              />
              {actionData?.errors?.password && (
                <FormErrorMessage id="password-error">{actionData.errors.password}</FormErrorMessage>
              )}
            </FormControl>

            <input type="hidden" name="redirectTo" value={redirectTo} />
            <Button type="submit" colorScheme="blue">
              ログイン
            </Button>

            <Stack direction={{ base: 'column', md: 'row' }} justify="space-between" color="gray.600" fontSize="sm">
              <Stack direction="row">
                <Checkbox id="remember" name="remenber" defaultChecked />
                <FormLabel htmlFor="remember" fontSize="sm">
                  ログインを記憶
                </FormLabel>
              </Stack>

              {/* 
              <Text>
                アカウントがない方は
                <AppLink
                  color="blue.500"
                  textDecoration="underline"
                  to={{
                    pathname: '/join',
                    search: searchParams.toString()
                  }}
                >
                  ユーザ登録
                </AppLink>
              </Text>
              */}
            </Stack>
          </Stack>
        </Form>
      </AppCenterFormFrame>

      <Box as="footer" textAlign="center" bgColor="white" py="4">
        Copyright &copy; TechTalk Inc.
      </Box>
    </Box>
  )
}
