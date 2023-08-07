import { Link } from '@remix-run/react'
import { AiOutlineGoogle } from 'react-icons/ai'
import { Button, type ButtonProps } from '~/app/components/ui'

interface GoogleLoginButtonProps extends ButtonProps {
  children?: React.ReactNode
}

export const GoogleLoginButton = ({ children, ...rest }: GoogleLoginButtonProps) => {
  return (
    <Button asChild type="submit" variant="outline" {...rest}>
      <Link to="/auth/google">
        <AiOutlineGoogle className="mr-2" />
        {children ?? 'Google'}
      </Link>
    </Button>
  )
}
