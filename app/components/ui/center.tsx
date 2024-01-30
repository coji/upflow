import { cn } from '~/app/libs/utils'

export interface CenterProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode
}
export const Center = ({ className, children, ...rest }: CenterProps) => {
  return (
    <div
      className={cn('flex h-full items-center justify-center', className)}
      {...rest}
    >
      {children}
    </div>
  )
}
