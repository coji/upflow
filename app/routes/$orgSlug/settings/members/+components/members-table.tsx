import {
  type ColumnDef,
  type RowData,
  type ColumnVisibilityState,
  flexRender,
  useTable,
} from '@tanstack/react-table'
import { useState } from 'react'
import {
  appTableFeatures,
  type AppTableFeatures,
} from '~/app/components/table-features'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/app/components/ui/table'
import type { MemberRow } from '../queries.server'
import {
  DataTablePagination,
  type PaginationProps,
} from './data-table-pagination'
import { DataTableToolbar } from './data-table-toolbar'

declare module '@tanstack/react-table' {
  interface ColumnMeta<TFeatures, TData extends RowData, TValue> {
    className: string
  }
  interface TableMeta<TFeatures, TData extends RowData> {
    currentMembershipId?: string
  }
}

interface DataTableProps {
  columns: ColumnDef<AppTableFeatures, MemberRow, any>[]
  data: MemberRow[]
  pagination: PaginationProps
  currentMembershipId: string
}

export function MembersTable({
  columns,
  data,
  pagination,
  currentMembershipId,
}: DataTableProps) {
  const [columnVisibility, setColumnVisibility] =
    useState<ColumnVisibilityState>({})

  const table = useTable({
    features: appTableFeatures,
    data,
    columns,
    getRowId: (row) => row.id,
    state: {
      columnVisibility,
    },
    onColumnVisibilityChange: setColumnVisibility,
    meta: { currentMembershipId },
  })

  return (
    <div className="space-y-4">
      <DataTableToolbar />
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="group/row">
                {headerGroup.headers.map((header) => {
                  return (
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
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} className="group/row">
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
    </div>
  )
}
