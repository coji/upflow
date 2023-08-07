import { useFetcher } from '@remix-run/react'
import React from 'react'
import { Button, type ButtonProps } from '~/app/components/ui'

interface LogoutButtonProps extends ButtonProps {
  children?: React.ReactNode
}
export const LogoutButton = ({ children, ...rest }: LogoutButtonProps) => {
  const fetcher = useFetcher()

  return (
    <fetcher.Form method="post" action="/logout">
      <Button type="submit" variant="outline" {...rest}>
        {children ? children : 'ログアウト'}
      </Button>
    </fetcher.Form>
  )
}
