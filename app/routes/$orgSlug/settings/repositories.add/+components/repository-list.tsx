import { cn } from '~/app/libs/utils'

export const RepositoryList = ({
  children,
  className,
  ...rest
}: React.ComponentProps<'div'>) => (
  <div className={cn('rounded border', className)} {...rest}>
    {children}
  </div>
)
