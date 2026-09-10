import {
  type ColumnDef,
  type RowData,
  type RowSelectionState,
  type ColumnVisibilityState,
  flexRender,
  useTable,
} from '@tanstack/react-table'
import { useState } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/app/components/ui/table'
import {
  appTableFeatures,
  type AppTableFeatures,
} from '~/app/components/table-features'
import type { TeamRow } from '~/app/routes/$orgSlug/settings/teams._index/queries.server'
import type { RepositoryRow } from '../queries.server'
import { DataTableFloatingBar } from './data-table-floating-bar'
import {
  DataTablePagination,
  type PaginationProps,
} from './data-table-pagination'
import { DataTableToolbar } from './data-table-toolbar'

declare module '@tanstack/react-table' {
  interface ColumnMeta<TFeatures, TData extends RowData, TValue> {
    className: string
  }
}

interface DataTableProps {
  columns: ColumnDef<AppTableFeatures, RepositoryRow, any>[]
  data: RepositoryRow[]
  pagination: PaginationProps
  teams: TeamRow[]
  orgSlug: string
  canAddRepositories: boolean
}

export function RepoTable({
  columns,
  data,
  pagination,
  teams,
  orgSlug,
  canAddRepositories,
}: DataTableProps) {
  const [columnVisibility, setColumnVisibility] =
    useState<ColumnVisibilityState>({})
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})

  const table = useTable({
    features: appTableFeatures,
    data,
    columns,
    getRowId: (row) => row.id,
    state: { columnVisibility, rowSelection },
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    enableRowSelection: true,
  })

  return (
    <div className="space-y-4">
      <DataTableToolbar
        teams={teams}
        orgSlug={orgSlug}
        canAddRepositories={canAddRepositories}
      />
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="group/row">
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    colSpan={header.colSpan}
                    className={header.column.columnDef.meta?.className ?? ''}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="group/row"
                  data-state={row.getIsSelected() && 'selected'}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={cell.column.columnDef.meta?.className ?? ''}
                    >
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
      <DataTablePagination pagination={pagination} />
      <DataTableFloatingBar table={table} teams={teams} />
    </div>
  )
}
