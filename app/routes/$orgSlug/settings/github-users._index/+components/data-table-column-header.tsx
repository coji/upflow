import type { Column } from '@tanstack/react-table'
import { ArrowDownIcon, ArrowUpIcon, ChevronsUpDownIcon } from 'lucide-react'
import { Button } from '~/app/components/ui/button'
import { cn } from '~/app/libs/utils'
import { useDataTableState } from '../+hooks/use-data-table-state'

interface DataTableColumnHeaderProps<
  TData,
  TValue,
> extends React.HTMLAttributes<HTMLDivElement> {
  column: Column<TData, TValue>
  title: string
}

export function DataTableColumnHeader<TData, TValue>({
  column,
  title,
  className,
}: DataTableColumnHeaderProps<TData, TValue>) {
  const { sort, updateSort } = useDataTableState()

  if (!column.getCanSort()) {
    return <div className={cn(className)}>{title}</div>
  }

  const isSorted = column.id === sort.sort_by

  const handleClick = () => {
    if (!isSorted) {
      updateSort({ sort_by: column.id, sort_order: 'asc' })
    } else if (sort.sort_order === 'asc') {
      updateSort({ sort_by: column.id, sort_order: 'desc' })
    } else {
      updateSort({})
    }
  }

  return (
    <div className={cn('flex items-center space-x-2', className)}>
      <Button
        variant="ghost"
        size="sm"
        className="-ml-3 h-8"
        onClick={handleClick}
      >
        <span>{title}</span>
        {isSorted && sort.sort_order === 'desc' ? (
          <ArrowDownIcon className="h-4 w-4" />
        ) : isSorted && sort.sort_order === 'asc' ? (
          <ArrowUpIcon className="h-4 w-4" />
        ) : (
          <ChevronsUpDownIcon className="h-4 w-4" />
        )}
      </Button>
    </div>
  )
}
