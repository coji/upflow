import type { ColumnDef } from '@tanstack/react-table'
import { AppSortableHeader } from '~/app/components'
import { AuthorBadge } from '~/app/components/author-badge'
import { ExternalLink } from '~/app/components/external-link'
import { SizeBadgePopover } from '~/app/components/size-badge-popover'
import { Badge, HStack } from '~/app/components/ui'
import dayjs from '~/app/libs/dayjs'
import { complexitySortingFn } from '~/app/libs/pr-classify'
import { hidePrActionsColumn } from '~/app/routes/$orgSlug/+components/hide-prs-by-title-menu'
import type { PullRequest } from './index'

export function createColumns(
  timezone: string,
  orgSlug: string,
  isAdmin: boolean,
): ColumnDef<PullRequest>[] {
  return [
    {
      accessorKey: 'author',
      header: ({ column }) => (
        <AppSortableHeader column={column} title="author" />
      ),
      cell: ({ row }) => (
        <AuthorBadge
          login={row.original.author}
          displayName={row.original.authorDisplayName}
        />
      ),
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
        <ExternalLink
          href={row.original.url}
          className="block w-96 truncate text-blue-500 hover:underline"
        >
          <span>{row.original.title}</span>
        </ExternalLink>
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
          orgSlug={orgSlug}
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
      accessorKey: 'firstReviewedAt',
      header: ({ column }) => (
        <AppSortableHeader column={column} title="First Review" />
      ),
      id: 'First Review',
      cell: ({ row }) =>
        row.original.firstReviewedAt
          ? dayjs
              .utc(row.original.firstReviewedAt)
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
      accessorKey: 'createAndMergeDiff',
      header: ({ column }) => (
        <AppSortableHeader column={column} title="Time to Merge" />
      ),
      cell: ({ row }) => (
        <HStack>
          <div>{row.original.createAndMergeDiff?.toFixed(1)}d</div>
          {!row.original.achievement && (
            <Badge variant="destructive">Over</Badge>
          )}
        </HStack>
      ),
      enableHiding: false,
    },
    ...hidePrActionsColumn<PullRequest>(isAdmin, (r) => r.title),
  ]
}
