import type React from 'react'
import type { ComponentProps } from 'react'
import { href, redirect, useFetcher } from 'react-router'
import { Button } from '~/app/components/ui'
import { getSession, sessionStorage } from '~/app/features/auth/services/auth'
import type { Route } from './+types/logout'

export const loader = async ({ request }: Route.LoaderArgs) => {
  const session = await getSession(request)
  const headers = new Headers()
  headers.append('Set-Cookie', await sessionStorage.destroySession(session))
  throw redirect(href('/login'), { headers })
}

interface LogoutButtonProps extends ComponentProps<typeof Button> {
  children?: React.ReactNode
}
export const LogoutButton = ({ children, ...rest }: LogoutButtonProps) => {
  const fetcher = useFetcher<typeof loader>()

  return (
    <fetcher.Form method="GET" action={href('/logout')}>
      <Button type="submit" variant="outline" {...rest}>
        {children ? children : 'ログアウト'}
      </Button>
    </fetcher.Form>
  )
}
