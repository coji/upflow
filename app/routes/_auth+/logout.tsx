import type React from 'react'
import { useFetcher } from 'react-router'
import { $path } from 'remix-routes'
import { Button, type ButtonProps } from '~/app/components/ui'
import { authenticator } from '~/app/features/auth/services/authenticator.server'
import type { Route } from './+types/logout'

export const loader = async ({ request }: Route.LoaderArgs) => {
  return await authenticator.logout(request, { redirectTo: '/' })
}

interface LogoutButtonProps extends ButtonProps {
  children?: React.ReactNode
}
export const LogoutButton = ({ children, ...rest }: LogoutButtonProps) => {
  const fetcher = useFetcher<typeof loader>()

  return (
    <fetcher.Form method="GET" action={$path('/logout')}>
      <Button type="submit" variant="outline" {...rest}>
        {children ? children : 'ログアウト'}
      </Button>
    </fetcher.Form>
  )
}
