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
          'block w-full rounded-md px-4 py-2 hover:bg-secondary/50',
          isActive && 'bg-secondary hover:bg-secondary',
          className,
        )
      }
      {...rest}
    >
      {children}
    </NavLink>
  )
}
