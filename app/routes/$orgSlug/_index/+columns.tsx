import type { ColumnDef } from '@tanstack/react-table'
import { AppSortableHeader } from '~/app/components'
import { Badge, HStack } from '~/app/components/ui'
import dayjs from '~/app/libs/dayjs'
import type { PullRequest } from './index'

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
      <AppSortableHeader column={column} title="First Commit" />
    ),
    id: 'First Commit',
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
      <AppSortableHeader column={column} title="PR Created" />
    ),
    id: 'PR Created',
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
      <AppSortableHeader column={column} title="First Review" />
    ),
    id: 'First Review',
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
      <AppSortableHeader column={column} title="Merged" />
    ),
    id: 'Merged',
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
      <AppSortableHeader column={column} title="Time to Merge" />
    ),
    cell: ({ row }) => (
      <HStack>
        <div>{row.original.createAndMergeDiff?.toFixed(1)}d</div>
        {!row.original.achievement && <Badge variant="destructive">Over</Badge>}
      </HStack>
    ),
    enableHiding: false,
  },
]
