import type { Column } from '@tanstack/react-table'
import { ArrowDownIcon, ArrowUpIcon, EyeOffIcon, XIcon } from 'lucide-react'
import { Button } from '~/app/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '~/app/components/ui/dropdown-menu'
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

  return (
    <div className={cn('flex items-center space-x-2', className)}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="data-[state=open]:bg-accent -ml-3 h-8"
          >
            <span>{title}</span>
            {column.id === sort.sort_by && sort.sort_order === 'desc' ? (
              <ArrowDownIcon className="h-4 w-4" />
            ) : column.id === sort.sort_by && sort.sort_order === 'asc' ? (
              <ArrowUpIcon className="h-4 w-4" />
            ) : (
              <span className="h-4 w-4" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem
            onClick={() =>
              updateSort({ sort_by: column.id, sort_order: 'asc' })
            }
          >
            <ArrowUpIcon className="text-muted-foreground/70 mr-2 h-3.5 w-3.5" />
            Asc
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() =>
              updateSort({ sort_by: column.id, sort_order: 'desc' })
            }
          >
            <ArrowDownIcon className="text-muted-foreground/70 mr-2 h-3.5 w-3.5" />
            Desc
          </DropdownMenuItem>
          {column.id === sort.sort_by && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => updateSort({})}>
                <XIcon className="text-muted-foreground/70 mr-2 h-3.5 w-3.5" />
                Clear sort
              </DropdownMenuItem>
            </>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => column.toggleVisibility(false)}>
            <EyeOffIcon className="text-muted-foreground/70 mr-2 h-3.5 w-3.5" />
            Hide
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
