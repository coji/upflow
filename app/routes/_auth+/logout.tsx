import type React from 'react'
import { redirect, useFetcher } from 'react-router'
import { $path } from 'safe-routes'
import { Button, type ButtonProps } from '~/app/components/ui'
import { getSession, sessionStorage } from '~/app/features/auth/services/auth'
import type { Route } from './+types/logout'

export const loader = async ({ request }: Route.LoaderArgs) => {
  const session = await getSession(request)
  const headers = new Headers()
  headers.append('Set-Cookie', await sessionStorage.destroySession(session))
  throw redirect('/login', { headers })
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
