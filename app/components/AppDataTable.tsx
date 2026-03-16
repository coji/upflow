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
  optionsChildren?: React.ReactNode
  /** Content rendered between the toolbar and the table. */
  children?: React.ReactNode
  /** Stable key for each row. When provided, row order is frozen until the user re-sorts via column header click. */
  getRowId?: (row: TData) => string
}

/**
 * Reorder rows according to a saved order snapshot.
 * Rows whose id is not in the snapshot are appended at the end.
 */
export function reorderRows<T extends { id: string }>(
  rows: T[],
  orderedIds: string[],
): T[] {
  const idToIndex = new Map(orderedIds.map((id, i) => [id, i]))
  const known: T[] = []
  const unknown: T[] = []
  for (const row of rows) {
    if (idToIndex.has(row.id)) {
      known.push(row)
    } else {
      unknown.push(row)
    }
  }
  known.sort((a, b) => (idToIndex.get(a.id) ?? 0) - (idToIndex.get(b.id) ?? 0))
  return [...known, ...unknown]
}

export function AppDataTable<TData, TValue>({
  title,
  columns,
  data,
  optionsChildren,
  children,
  getRowId,
}: AppDataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>(
      Object.fromEntries(
        columns
          .filter(
            (column) =>
              'accessorKey' in column && column.enableHiding !== false,
          )
          .map((column) => [
            column.id ?? ('accessorKey' in column ? column.accessorKey : ''),
            false,
          ]),
      ),
    )
  const table = useReactTable({
    data,
    columns,
    getRowId,
    getCoreRowModel: getCoreRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    state: { sorting, columnVisibility },
  })

  // Stable sort: snapshot the sorted row order and only update it when
  // the user explicitly changes the sort (column header click).
  // Data changes (e.g. revalidation after inline edit) do NOT re-order rows.
  const sortedRows = table.getSortedRowModel().rows
  const [orderSnapshot, setOrderSnapshot] = React.useState<string[]>(() =>
    sortedRows.map((r) => r.id),
  )

  // Update snapshot only when sorting state changes (user clicked a header).
  // We use a ref to track the previous sorting to detect actual changes.
  const prevSortingRef = React.useRef(sorting)
  React.useEffect(() => {
    if (prevSortingRef.current !== sorting) {
      prevSortingRef.current = sorting
      setOrderSnapshot(sortedRows.map((r) => r.id))
    }
  }, [sorting, sortedRows])

  const displayRows = React.useMemo(
    () =>
      getRowId != null ? reorderRows(sortedRows, orderSnapshot) : sortedRows,
    [getRowId, sortedRows, orderSnapshot],
  )

  return (
    <Stack>
      <HStack>
        <div>{title}</div>
        <div className="flex-1" />
        <AppDataTableViewOptions table={table}>
          {optionsChildren}
        </AppDataTableViewOptions>
      </HStack>
      {children}
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
            {displayRows.length ? (
              displayRows.map((row) => (
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
