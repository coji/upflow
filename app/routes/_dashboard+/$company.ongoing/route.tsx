import type { LoaderFunctionArgs } from '@remix-run/node'
import { useLoaderData } from '@remix-run/react'
import type { ColumnDef } from '@tanstack/react-table'
import { z } from 'zod'
import { zx } from 'zodix'
import { AppDataTable, AppSortableHeader } from '~/app/components'
import { Stack } from '~/app/components/ui'
import dayjs from '~/app/libs/dayjs'
import { getOngoingPullRequestReport } from './functions.server'

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const { company: companyId } = zx.parseParams(params, { company: z.string() })
  const from = null
  const to = dayjs().utc().toISOString()

  const pullRequests = await getOngoingPullRequestReport(companyId, from, to)
  return { companyId, pullRequests, from, to }
}

export type PullRequest = Awaited<
  ReturnType<typeof getOngoingPullRequestReport>
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
    accessorKey: 'firstCommittedAt',
    header: ({ column }) => (
      <AppSortableHeader column={column} title="初コミット" />
    ),
    id: '初コミット',
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
    header: ({ column }) => (
      <AppSortableHeader column={column} title="Duration" />
    ),
    id: 'Duration',
    accessorFn: ({ createAndNowDiff }) => createAndNowDiff,
    cell: ({ row }) => (
      <span className="whitespace-nowrap">
        {row.original.createAndNowDiff.toFixed(1)}
        <small>日</small>
      </span>
    ),
    enableHiding: false,
  },
]

export default function OngoingPage() {
  const { pullRequests, from, to } = useLoaderData<typeof loader>()

  return (
    <Stack>
      <div className="grid grid-cols-2">
        <div>From</div>
        <div>{from}</div>
        <div>To</div>
        <div>{to}</div>
      </div>
      <AppDataTable
        title={
          <div>
            進行中のプルリクエスト {pullRequests.length}
            <small>件</small>
          </div>
        }
        columns={columns}
        data={pullRequests}
      />
    </Stack>
  )
}
