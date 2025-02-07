import type { ColumnDef } from '@tanstack/react-table'
import { AppSortableHeader } from '~/app/components'
import { Badge, HStack } from '~/app/components/ui'
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
    cell: ({ row }) => (
      <HStack>
        <div>{row.original.createAndMergeDiff?.toFixed(1)}日</div>
        {!row.original.achievement && <Badge variant="destructive">超過</Badge>}
      </HStack>
    ),
    enableHiding: false,
  },
]
