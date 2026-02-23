import type React from 'react'
import { cn } from '~/app/libs/utils'

interface MainProps extends React.ComponentPropsWithRef<'main'> {
  fixed?: boolean
}

export const Main = ({ fixed, ...props }: MainProps) => {
  return (
    <main
      className={cn('px-4 py-6', fixed && 'flex grow flex-col overflow-hidden')}
      {...props}
    />
  )
}

Main.displayName = 'Main'
