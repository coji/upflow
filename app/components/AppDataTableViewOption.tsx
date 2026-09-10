import type { RowData, Table } from '@tanstack/react-table'
import { Settings2Icon } from 'lucide-react'
import type React from 'react'
import { match, P } from 'ts-pattern'
import {
  Button,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '~/app/components/ui'
import type { AppTableFeatures } from '~/app/components/table-features'

interface AppDataTableViewOptionsProps<TData extends RowData> {
  table: Table<AppTableFeatures, TData>
  children?: React.ReactNode
}
export function AppDataTableViewOptions<TData extends RowData>({
  table,
  children,
}: AppDataTableViewOptionsProps<TData>) {
  const hideableColumns = table
    .getAllColumns()
    .filter(
      (column) =>
        typeof column.accessorFn !== 'undefined' && column.getCanHide(),
    )

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm">
          <Settings2Icon className="h-4 w-4" />
          Options
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56">
        {children && (
          <>
            {children}
            <DropdownMenuSeparator />
          </>
        )}
        {hideableColumns.length > 0 && (
          <>
            <DropdownMenuLabel>Columns</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {hideableColumns.map((column) => {
              const title = match(column.columnDef.header)
                .with(P.string, () => String(column.columnDef.header))
                .with(P.nullish, () => column.id)
                .otherwise(() => column.id)

              return (
                <DropdownMenuCheckboxItem
                  key={column.id}
                  className="capitalize"
                  checked={column.getIsVisible()}
                  onCheckedChange={(value) => column.toggleVisibility(!!value)}
                >
                  {title}
                </DropdownMenuCheckboxItem>
              )
            })}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
