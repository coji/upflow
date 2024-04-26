import type { Column } from '@tanstack/react-table'
import { ArrowDownAZIcon, ArrowUpAZIcon } from 'lucide-react'
import { match } from 'ts-pattern'

import { Button, type ButtonProps } from '~/app/components/ui'

interface AppSortableHeaderProps<TData> extends ButtonProps {
  column: Column<TData>
  title: string
}
export const AppSortableHeader = <TData,>({
  column,
  title,
  ...rest
}: AppSortableHeaderProps<TData>) => {
  const handleSort = () => {
    match(column.getIsSorted())
      .with(false, () => column.toggleSorting(false))
      .with('asc', () => column.toggleSorting(true))
      .with('desc', () => column.clearSorting())
      .exhaustive()
  }

  return (
    <Button
      variant="ghost"
      className="w-full cursor-pointer select-none"
      onClick={handleSort}
      {...rest}
      asChild
    >
      <div>
        <span className="capitalize">{title}</span>
        <span className="ml-2">
          {column.getIsSorted() === 'asc' && (
            <ArrowDownAZIcon className="h-4 w-4 text-muted-foreground" />
          )}
          {column.getIsSorted() === 'desc' && (
            <ArrowUpAZIcon className="h-4 w-4 text-muted-foreground" />
          )}
        </span>
      </div>
    </Button>
  )
}
