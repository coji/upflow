import type { ActionFunctionArgs } from '@remix-run/node'
import { useFetcher } from '@remix-run/react'
import type React from 'react'
import { Button, type ButtonProps } from '~/app/components/ui'
import { authenticator } from '~/app/features/auth/services/authenticator.server'

export const loader = async ({ request }: ActionFunctionArgs) => {
  await authenticator.logout(request, { redirectTo: '/' })
}

interface LogoutButtonProps extends ButtonProps {
  children?: React.ReactNode
}
export const LogoutButton = ({ children, ...rest }: LogoutButtonProps) => {
  const fetcher = useFetcher()

  return (
    <fetcher.Form method="GET" action="/logout">
      <Button type="submit" variant="outline" {...rest}>
        {children ? children : 'ログアウト'}
      </Button>
    </fetcher.Form>
  )
}
