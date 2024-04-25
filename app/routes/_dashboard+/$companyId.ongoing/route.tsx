import type { LoaderFunctionArgs } from '@remix-run/node'
import type { ColumnDef } from '@tanstack/react-table'
import { typedjson, useTypedLoaderData } from 'remix-typedjson'
import { z } from 'zod'
import { zx } from 'zodix'
import { AppDataTable } from '~/app/components'
import dayjs from '~/app/libs/dayjs'
import { getOngoingPullRequestReport, getStartOfWeek } from './functions.server'

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const { companyId } = zx.parseParams(params, { companyId: z.string() })
  const startOfWeek = getStartOfWeek()
  const pullRequests = await getOngoingPullRequestReport(companyId, startOfWeek)
  return typedjson({ companyId, pullRequests, startOfWeek })
}

export type PullRequest = Awaited<
  ReturnType<typeof getOngoingPullRequestReport>
>[0]

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
    enableHiding: false,
  },
  {
    accessorKey: 'title',
    cell: ({ row }) => (
      <div className="w-80 truncate">{`[${row.original.title}](${row.original.url})`}</div>
    ),
    enableHiding: false,
  },

  {
    header: '初コミット',
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
    header: 'PR作成',
    accessorKey: 'pullRequestCreatedAt',
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
    header: '初レビュー',
    cell: ({ row }) =>
      row.original.firstReviewedAt
        ? dayjs
            .utc(row.original.firstReviewedAt)
            .tz('Asia/Tokyo')
            .format('YYYY-MM-DD HH:mm')
        : '',
  },
  {
    header: 'duration',
    cell: ({ row }) => (
      <span className="whitespace-nowrap">
        {row.original.createAndNowDiff.toFixed(1)}
        <small>日</small>
      </span>
    ),
  },
]

export default function OngoingPage() {
  const { pullRequests } = useTypedLoaderData<typeof loader>()

  return (
    <div>
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
    </div>
  )
}
