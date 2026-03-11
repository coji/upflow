import type { ColumnDef } from '@tanstack/react-table'
import { AppSortableHeader } from '~/app/components'
import { Avatar, AvatarFallback, AvatarImage } from '~/app/components/ui/avatar'
import dayjs from '~/app/libs/dayjs'
import { SizeBadgePopover } from '../+components/size-badge-popover'
import { complexitySortingFn } from '../reviews/+functions/classify'
import type { PullRequest } from './index'

export const columns: ColumnDef<PullRequest>[] = [
  {
    accessorKey: 'author',
    header: ({ column }) => (
      <AppSortableHeader column={column} title="author" />
    ),
    cell: ({ row }) => {
      const login = row.original.author
      return (
        <div className="flex items-center gap-2">
          <Avatar className="size-6">
            <AvatarImage
              src={`https://github.com/${login}.png?size=48`}
              alt={login}
            />
            <AvatarFallback className="text-xs">
              {login.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span>{row.original.authorDisplayName || login}</span>
        </div>
      )
    },
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
    accessorKey: 'complexity',
    header: ({ column }) => <AppSortableHeader column={column} title="Size" />,
    cell: ({ row }) => (
      <SizeBadgePopover
        complexity={row.original.complexity}
        complexityReason={row.original.complexityReason}
        riskAreas={row.original.riskAreas}
        correctedComplexity={row.original.correctedComplexity}
        repositoryId={row.original.repositoryId}
        number={row.original.number}
      />
    ),
    sortingFn: complexitySortingFn,
    enableHiding: false,
  },
  {
    accessorKey: 'firstCommittedAt',
    header: ({ column }) => (
      <AppSortableHeader column={column} title="First Commit" />
    ),
    id: 'First Commit',
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
    header: ({ column }) => (
      <AppSortableHeader column={column} title="Duration" />
    ),
    id: 'Duration',
    accessorFn: ({ createAndNowDiff }) => createAndNowDiff,
    cell: ({ row }) => (
      <span className="whitespace-nowrap">
        {row.original.createAndNowDiff.toFixed(1)}
        <small>d</small>
      </span>
    ),
    enableHiding: false,
  },
]
