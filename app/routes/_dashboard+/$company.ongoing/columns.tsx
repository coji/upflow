import type { ColumnDef } from '@tanstack/react-table'
import { AppSortableHeader } from '~/app/components'
import dayjs from '~/app/libs/dayjs'
import type { PullRequest } from './route'

export const columns: ColumnDef<PullRequest>[] = [
  {
    accessorKey: 'author',
    header: ({ column }) => (
      <AppSortableHeader column={column} title="author" />
    ),
    cell: ({ cell }) => cell.row.original.authorDisplayName || cell.getValue(),
    enableHiding: false,
  },
  {
    accessorKey: 'repo',
    header: ({ column }) => <AppSortableHeader column={column} title="repo" />,
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
