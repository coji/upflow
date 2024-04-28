import type { LoaderFunctionArgs } from '@remix-run/node'
import { useLoaderData } from '@remix-run/react'
import type { ColumnDef } from '@tanstack/react-table'
import { z } from 'zod'
import { zx } from 'zodix'
import { AppDataTable, AppSortableHeader } from '~/app/components'
import dayjs from '~/app/libs/dayjs'
import { getMergedPullRequestReport, getStartOfWeek } from './functions.server'

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const { companyId } = zx.parseParams(params, { companyId: z.string() })
  const startOfWeek = getStartOfWeek()
  const pullRequests = await getMergedPullRequestReport(companyId, startOfWeek)
  return { companyId, pullRequests, startOfWeek }
}

export type PullRequest = Awaited<
  ReturnType<typeof getMergedPullRequestReport>
>[0]

const columns: ColumnDef<PullRequest>[] = [
  {
    accessorKey: 'author',
    header: ({ column }) => (
      <AppSortableHeader column={column} title="author" />
    ),
    cell: ({ cell }) => cell.getValue(),
    enableHiding: false,
  },
  {
    accessorKey: 'number',
    header: ({ column }) => <AppSortableHeader column={column} title="No" />,
    cell: ({ cell }) => cell.getValue(),
    enableHiding: false,
  },
  {
    accessorKey: 'title',
    header: ({ column }) => <AppSortableHeader column={column} title="title" />,
    cell: ({ row }) => (
      <a
        href={row.original.url}
        className="overflow:underline block w-96 truncate text-blue-500"
        target="_blank"
        rel="noreferrer noopener"
      >
        <span>{row.original.title}</span>
      </a>
    ),
    enableHiding: false,
  },
  {
    header: ({ column }) => (
      <AppSortableHeader column={column} title="初コミット" />
    ),
    id: '初コミット',
    accessorKey: 'firstCommittedAt',
    cell: ({ row }) =>
      row.original.firstCommittedAt
        ? dayjs
            .utc(row.original.firstCommittedAt)
            .tz('Asia/Tokyo')
            .format('YYYY-MM-DD HH:mm')
        : '',
  },
  {
    accessorKey: 'pullRequestCreatedAt',
    header: ({ column }) => (
      <AppSortableHeader column={column} title="PR作成" />
    ),
    id: 'PR作成',
    cell: ({ row }) =>
      row.original.pullRequestCreatedAt
        ? dayjs
            .utc(row.original.pullRequestCreatedAt)
            .tz('Asia/Tokyo')
            .format('YYYY-MM-DD HH:mm')
        : '',
  },
  {
    accessorKey: 'firstReviewedAt',
    header: ({ column }) => (
      <AppSortableHeader column={column} title="初レビュー" />
    ),
    id: '初レビュー',
    cell: ({ row }) =>
      row.original.firstReviewedAt
        ? dayjs
            .utc(row.original.firstReviewedAt)
            .tz('Asia/Tokyo')
            .format('YYYY-MM-DD HH:mm')
        : '',
  },
  {
    accessorKey: 'mergedAt',
    header: ({ column }) => (
      <AppSortableHeader column={column} title="マージ" />
    ),
    id: 'マージ',
    cell: ({ row }) =>
      row.original.mergedAt
        ? dayjs
            .utc(row.original.mergedAt)
            .tz('Asia/Tokyo')
            .format('YYYY-MM-DD HH:mm')
        : '',
  },
  {
    accessorKey: 'createAndMergeDiff',
    header: ({ column }) => (
      <AppSortableHeader column={column} title="マージまで" />
    ),
    cell: ({ row }) => `${row.original.createAndMergeDiff?.toFixed(1)}日`,
    enableHiding: false,
  },
]

export default function CompanyIndex() {
  const { pullRequests } = useLoaderData<typeof loader>()

  return (
    <div>
      <AppDataTable
        title={
          <div>
            今週マージされたプルリクエスト {pullRequests.length}{' '}
            <small>件</small>
          </div>
        }
        columns={columns}
        data={pullRequests}
      />
    </div>
  )
}
