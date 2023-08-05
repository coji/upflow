import type { ButtonProps } from '@chakra-ui/react'
import { Button } from '@chakra-ui/react'
import { Link as RemixLink, useNavigation } from '@remix-run/react'
import { AiOutlineGoogle } from 'react-icons/ai'

interface GoogleLoginButtonProps extends ButtonProps {
  children?: React.ReactNode
}

export const GoogleLoginButton = ({ children, ...rest }: GoogleLoginButtonProps) => {
  const navigation = useNavigation()
  const isLoading = navigation.state !== 'idle' && navigation.location.pathname === '/auth/google'

  return (
    <Button
      as={RemixLink}
      to="/auth/google"
      colorScheme="blue"
      isLoading={isLoading}
      leftIcon={<AiOutlineGoogle />}
      type="submit"
      variant="outline"
      {...rest}
    >
      {children ?? 'Google'}
    </Button>
  )
}
