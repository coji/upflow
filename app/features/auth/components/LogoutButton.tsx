import { Button, type ButtonProps } from '@chakra-ui/react'
import { useFetcher } from '@remix-run/react'
import React from 'react'

interface LogoutButtonProps extends ButtonProps {
  children?: React.ReactNode
}
export const LogoutButton = ({ children, ...rest }: LogoutButtonProps) => {
  const fetcher = useFetcher()
  const isLoading = fetcher.state !== 'idle'

  return (
    <fetcher.Form method="post" action="/logout">
      <Button type="submit" colorScheme="teal" variant="outline" isLoading={isLoading} {...rest}>
        {children ? children : 'ログアウト'}
      </Button>
    </fetcher.Form>
  )
}
