import type { Column } from '@tanstack/react-table'
import { ArrowDownAZIcon, ArrowUpAZIcon } from 'lucide-react'

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
    column.toggleSorting(column.getIsSorted() === 'asc')
  }

  return (
    <Button variant="ghost" className="w-full" onClick={handleSort} {...rest}>
      <span className="capitalize">{title}</span>
      <span className="ml-2">
        {column.getIsSorted() === 'asc' && (
          <ArrowDownAZIcon className="h-4 w-4 text-muted-foreground" />
        )}
        {column.getIsSorted() === 'desc' && (
          <ArrowUpAZIcon className="h-4 w-4 text-muted-foreground" />
        )}
      </span>
    </Button>
  )
}
