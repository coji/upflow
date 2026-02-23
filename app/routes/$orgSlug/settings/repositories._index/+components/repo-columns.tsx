import type { ColumnDef } from '@tanstack/react-table'
import { ExternalLinkIcon } from 'lucide-react'
import { Link } from 'react-router'
import { match } from 'ts-pattern'
import { Badge } from '~/app/components/ui/badge'
import type { RepositoryRow } from '../queries.server'
import { DataTableColumnHeader } from './data-table-column-header'
import { RepoRowActions } from './repo-row-actions'

export const createColumns = (orgSlug: string): ColumnDef<RepositoryRow>[] => [
  {
    id: 'repo',
    accessorFn: (row) => `${row.owner}/${row.repo}`,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Repository" />
    ),
    cell: ({ row }) => {
      const { owner, repo, provider } = row.original
      const repoUrl = match(provider)
        .with('github', () => `https://github.com/${owner}/${repo}`)
        .otherwise(() => '')
      return (
        <Link
          to={repoUrl}
          target="_blank"
          className="inline-flex items-center gap-1 font-medium hover:underline"
        >
          {owner}/{repo}
          <ExternalLinkIcon className="h-3 w-3" />
        </Link>
      )
    },
    enableHiding: false,
  },
  {
    accessorKey: 'releaseDetectionMethod',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Method" />
    ),
    cell: ({ row }) => (
      <Badge variant="outline">{row.getValue('releaseDetectionMethod')}</Badge>
    ),
    enableSorting: false,
  },
  {
    accessorKey: 'releaseDetectionKey',
    header: 'Key',
    cell: ({ row }) => (
      <code className="text-sm">{row.getValue('releaseDetectionKey')}</code>
    ),
    enableSorting: false,
  },
  {
    id: 'actions',
    cell: ({ row }) => <RepoRowActions row={row} orgSlug={orgSlug} />,
  },
]
