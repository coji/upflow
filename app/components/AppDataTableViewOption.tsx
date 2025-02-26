import type { Table } from '@tanstack/react-table'
import { Settings2Icon } from 'lucide-react'
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

interface AppDataTableViewOptionsProps<TData> {
  table: Table<TData>
}
export function AppDataTableViewOptions<TData>({
  table,
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
        <Button variant="outline" size="sm">
          <Settings2Icon className="h-4 w-4" />
          オプション
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56">
        {hideableColumns.length > 0 && (
          <>
            <DropdownMenuLabel>列の表示</DropdownMenuLabel>
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
