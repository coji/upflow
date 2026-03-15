import type { ColumnDef } from '@tanstack/react-table'
import { AppSortableHeader } from '~/app/components'
import { SizeBadgePopover } from '~/app/components/size-badge-popover'
import { Badge, HStack } from '~/app/components/ui'
import { Avatar, AvatarFallback, AvatarImage } from '~/app/components/ui/avatar'
import dayjs from '~/app/libs/dayjs'
import { complexitySortingFn } from '~/app/libs/pr-classify'
import type { PullRequest } from './index'

export function createColumns(timezone: string): ColumnDef<PullRequest>[] {
  return [
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
      header: ({ column }) => (
        <AppSortableHeader column={column} title="repo" />
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
      header: ({ column }) => (
        <AppSortableHeader column={column} title="title" />
      ),
      cell: ({ row }) => (
        <a
          href={row.original.url}
          className="block w-96 truncate text-blue-500 hover:underline"
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
      header: ({ column }) => (
        <AppSortableHeader column={column} title="Size" />
      ),
      cell: ({ row }) => (
        <SizeBadgePopover
          complexity={row.original.complexity}
          complexityReason={row.original.complexityReason}
          riskAreas={row.original.riskAreas}
          correctedComplexity={row.original.correctedComplexity}
          reason={row.original.reason}
          feedbackBy={row.original.feedbackBy}
          feedbackByLogin={row.original.feedbackByLogin}
          feedbackAt={row.original.feedbackAt}
          repositoryId={row.original.repositoryId}
          number={row.original.number}
        />
      ),
      sortingFn: complexitySortingFn,
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
              .tz(timezone)
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
              .tz(timezone)
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
              .tz(timezone)
              .format('YYYY-MM-DD HH:mm')
          : '',
    },
    {
      accessorKey: 'releasedAt',
      header: ({ column }) => (
        <AppSortableHeader column={column} title="Released" />
      ),
      id: 'Released',
      cell: ({ row }) =>
        row.original.releasedAt
          ? dayjs
              .utc(row.original.releasedAt)
              .tz(timezone)
              .format('YYYY-MM-DD HH:mm')
          : '',
    },
    {
      accessorKey: 'deployTime',
      header: ({ column }) => (
        <AppSortableHeader column={column} title="Deploy Time" />
      ),
      cell: ({ row }) =>
        row.original.deployTime != null ? (
          <div>{row.original.deployTime.toFixed(1)}d</div>
        ) : null,
    },
    {
      accessorKey: 'createAndDeployDiff',
      header: ({ column }) => (
        <AppSortableHeader column={column} title="Time to Deploy" />
      ),
      cell: ({ row }) => (
        <HStack>
          <div>{row.original.createAndDeployDiff?.toFixed(1)}d</div>
          {!row.original.achievement && (
            <Badge variant="destructive">Over</Badge>
          )}
        </HStack>
      ),
      enableHiding: false,
    },
  ]
}
