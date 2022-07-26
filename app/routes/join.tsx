import type { ActionArgs, LoaderArgs, MetaFunction } from '@remix-run/node'
import { json, redirect } from '@remix-run/node'
import { getUserId, createUserSession } from '~/app/session.server'
import { createUser, getUserByEmail } from '~/app/models/user.server'
import { safeRedirect, validateEmail } from '~/app/utils'

import * as React from 'react'
import { Form, useActionData, useSearchParams } from '@remix-run/react'
import { Heading, Stack, Box, Text, Input, FormControl, FormLabel, FormErrorMessage, Button } from '@chakra-ui/react'
import { AppLink } from '~/app/components/AppLink'

export const loader = async ({ request }: LoaderArgs) => {
  const userId = await getUserId(request)
  if (userId) return redirect('/')
  return json({})
}

interface ActionData {
  errors: {
    email?: string
    password?: string
  }
}

export const action = async ({ request }: ActionArgs) => {
  const formData = await request.formData()
  const email = formData.get('email')
  const password = formData.get('password')
  const redirectTo = safeRedirect(formData.get('redirectTo'), '/')

  if (!validateEmail(email)) {
    return json<ActionData>({ errors: { email: 'Email is invalid' } }, { status: 400 })
  }

  if (typeof password !== 'string' || password.length === 0) {
    return json<ActionData>({ errors: { password: 'Password is required' } }, { status: 400 })
  }

  if (password.length < 8) {
    return json<ActionData>({ errors: { password: 'Password is too short' } }, { status: 400 })
  }

  const existingUser = await getUserByEmail(email)
  if (existingUser) {
    return json<ActionData>({ errors: { email: 'A user already exists with this email' } }, { status: 400 })
  }

  const user = await createUser(email, password)

  return createUserSession({
    request,
    userId: user.id,
    remember: false,
    redirectTo
  })
}

export const meta: MetaFunction = () => {
  return {
    title: 'Sign Up'
  }
}

export default function Join() {
  const [searchParams] = useSearchParams()
  const redirectTo = searchParams.get('redirectTo') ?? undefined
  const actionData = useActionData<typeof action>()
  const emailRef = React.useRef<HTMLInputElement>(null)
  const passwordRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    if (actionData?.errors?.email) {
      emailRef.current?.focus()
    } else if (actionData?.errors?.password) {
      passwordRef.current?.focus()
    }
  }, [actionData])

  return (
    <Box display="flex" flexDirection="column" bgColor="gray.100" minH="100vh">
      <Box flex="1" p="8">
        <Box bgColor="white" p="8" maxW="container.sm" mx="auto" rounded="md" boxShadow="md">
          <Heading fontSize="4xl" p="8" textAlign="center" color="blue.800" dropShadow="2xl">
            UpFlow
          </Heading>

          <Box mx="auto" w="full" maxW="md" px="8" mt="4">
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

                  {actionData?.errors?.email && <FormErrorMessage id="email-error">{actionData.errors.email}</FormErrorMessage>}
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
                  {actionData?.errors?.password && <FormErrorMessage id="password-error">{actionData.errors.password}</FormErrorMessage>}
                </FormControl>

                <input type="hidden" name="redirectTo" value={redirectTo} />
                <Button type="submit" colorScheme="blue">
                  アカウント登録
                </Button>

                <Text textAlign="right" color="gray.600" fontSize="sm">
                  すでにアカウントがある方は
                  <AppLink
                    color="blue.500"
                    textDecoration="underline"
                    to={{
                      pathname: '/',
                      search: searchParams.toString()
                    }}
                  >
                    ログイン
                  </AppLink>
                </Text>
              </Stack>
            </Form>
          </Box>
        </Box>
      </Box>

      <Box as="footer" textAlign="center" bgColor="gray.200" py="4">
        Copyright &copy; TechTalk Inc.
      </Box>
    </Box>
  )
}
