import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
  type VisibilityState,
} from '@tanstack/react-table'
import React from 'react'

import { AppDataTableViewOptions } from '~/app/components/AppDataTableViewOption'
import {
  HStack,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/app/components/ui'

interface AppDataTableProps<TData, TValue> {
  title?: React.ReactNode
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
}

export function AppDataTable<TData, TValue>({
  title,
  columns,
  data,
}: AppDataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>(
      columns
        .filter(
          (column) => 'accessorKey' in column && column.enableHiding !== false,
        )
        .reduce(
          // @ts-ignore
          // biome-ignore lint/performance/noAccumulatingSpread: <explanation>
          (acc, obj) => ({ ...acc, [obj.id ?? obj.accessorKey]: false }),
          {},
        ),
    )
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    state: { sorting, columnVisibility },
  })

  return (
    <Stack>
      <HStack>
        <div>{title}</div>
        <div className="flex-1" />
        <AppDataTableViewOptions table={table} />
      </HStack>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() ? 'selected' : null}
                  className="group"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </Stack>
  )
}
