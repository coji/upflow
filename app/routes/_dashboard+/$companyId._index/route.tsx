import type { LoaderFunctionArgs } from '@remix-run/node'
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from '@tanstack/react-table'
import { typedjson, useTypedLoaderData } from 'remix-typedjson'
import { z } from 'zod'
import { zx } from 'zodix'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/app/components/ui'
import { getMergedPullRequestReport, getStartOfWeek } from './functions.server'

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const { companyId } = zx.parseParams(params, { companyId: z.string() })
  const startOfWeek = getStartOfWeek()
  const pullRequests = await getMergedPullRequestReport(companyId, startOfWeek)
  return typedjson({ companyId, pullRequests, startOfWeek })
}

export type PullRequest = Awaited<
  ReturnType<typeof getMergedPullRequestReport>
>[0]
const columnHelper = createColumnHelper<PullRequest>()

const columns: ColumnDef<PullRequest>[] = [
  {
    accessorKey: 'number',
    cell: (info) => (
      <a
        href={info.row.original.url}
        className="overflow:underline text-blue-500"
        target="_blank"
        rel="noreferrer noopener"
      >
        {info.renderValue<string>()}
      </a>
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: 'author',
    cell: ({ cell }) => cell.getValue(),
  },
  {
    accessorKey: 'title',
    cell: ({ row }) => `[${row.original.title}](${row.original.url})`,
  },
  {
    header: 'マージまで',
    cell: ({ row }) => `${row.original.createAndMergeDiff?.toFixed(1)}日`,
  },
]

export default function CompanyLayout() {
  const { companyId, pullRequests } = useTypedLoaderData<typeof loader>()

  const table = useReactTable({
    data: pullRequests,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => `${row.repo}-${row.number}`,
  })

  return (
    <div>
      <div>今週マージされたプルリクエスト {pullRequests.length}件</div>
      <div className="overflow-auto">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className="capitalize">
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext(),
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getAllCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
