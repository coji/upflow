import { cn } from '~/app/libs/utils'

function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="skeleton"
      className={cn('bg-primary/10 animate-pulse rounded-md', className)}
      {...props}
    />
  )
}

export { Skeleton }
