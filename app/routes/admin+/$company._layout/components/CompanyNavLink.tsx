import { NavLink } from 'react-router'
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
          'hover:bg-accent block w-full px-2 py-1.5',
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
