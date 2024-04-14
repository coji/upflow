import { NavLink } from '@remix-run/react'
import { cn } from '~/app/libs/utils'

export const CompanyNavLink = ({
  to,
  children,
  className,
  ...rest
}: React.ComponentProps<typeof NavLink>) => {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          'block w-full px-2 py-1.5 hover:bg-accent',
          isActive && 'focus:bg-accent',
          className,
        )
      }
      {...rest}
    >
      {children}
    </NavLink>
  )
}
