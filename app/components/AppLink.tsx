import { Link, type LinkProps } from '@remix-run/react'

const AppLink = ({ children, ...rest }: LinkProps) => <Link {...rest}>{children}</Link>
AppLink.displayName = 'AppLink'

export { AppLink }
