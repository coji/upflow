import type { AlertProps } from '@chakra-ui/react'
import { Alert, AlertIcon, Box } from '@chakra-ui/react'

type AppAlertProps = AlertProps
export const AppAlert = (props: AppAlertProps) => {
  const { children, ...rest } = props
  return (
    <Alert {...rest} variant="solid" rounded="md">
      <AlertIcon />
      <Box textAlign="left">{children}</Box>
    </Alert>
  )
}
