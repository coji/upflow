import type React from 'react'
import { cn } from '~/app/libs/utils'

interface MainProps extends React.ComponentPropsWithRef<'main'> {
  fixed?: boolean
}

export const Main = ({ fixed, className, ...props }: MainProps) => {
  return (
    <main
      className={cn(
        'px-4 pt-0 pb-2',
        fixed && 'flex grow flex-col overflow-hidden',
        className,
      )}
      {...props}
    />
  )
}

Main.displayName = 'Main'
