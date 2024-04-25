import { MixerHorizontalIcon } from '@radix-ui/react-icons'
import type { Table } from '@tanstack/react-table'
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
          <MixerHorizontalIcon className="mr-2 h-4 w-4" />
          オプション
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56">
        {hideableColumns.length > 0 && (
          <>
            <DropdownMenuLabel>列の表示</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {hideableColumns.map((column) => {
              return (
                <DropdownMenuCheckboxItem
                  key={column.id}
                  className="capitalize"
                  checked={column.getIsVisible()}
                  onCheckedChange={(value) => column.toggleVisibility(!!value)}
                >
                  {column.columnDef.header?.toString() ?? ''}
                  {/* {column.columnDef.header?.toString() ?? column.id} */}
                </DropdownMenuCheckboxItem>
              )
            })}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
