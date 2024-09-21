import type { LoaderFunctionArgs } from '@remix-run/node'
import { useFetcher } from '@remix-run/react'
import type React from 'react'
import { $path } from 'remix-routes'
import { Button, type ButtonProps } from '~/app/components/ui'
import { authenticator } from '~/app/features/auth/services/authenticator.server'

export const loader = async ({ request }: LoaderFunctionArgs) => {
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
