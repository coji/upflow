import type { ColumnDef } from '@tanstack/react-table'
import { AlertTriangleIcon, ExternalLinkIcon } from 'lucide-react'
import { Link, useFetcher } from 'react-router'
import { match } from 'ts-pattern'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '~/app/components/ui'
import { Badge } from '~/app/components/ui/badge'
import { Button } from '~/app/components/ui/button'
import { Checkbox } from '~/app/components/ui/checkbox'
import { isRepositoryBroken } from '~/app/libs/github-account'
import type { TeamRow } from '../../teams._index/queries.server'
import type { RepositoryRow } from '../queries.server'
import { DataTableColumnHeader } from './data-table-column-header'
import { RepoRowActions } from './repo-row-actions'

function NeedsReconnectionBadge({ repositoryId }: { repositoryId: string }) {
  const fetcher = useFetcher()
  const isReassigning = fetcher.state !== 'idle'
  return (
    <span className="ml-2 inline-flex items-center gap-1">
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="destructive" className="gap-1">
            <AlertTriangleIcon className="h-3 w-3" />
            Needs reconnection
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          The GitHub App installation that owned this repository was removed.
          Click Reassign to try another active installation, or reinstall the
          GitHub App.
        </TooltipContent>
      </Tooltip>
      <fetcher.Form method="post">
        <input type="hidden" name="intent" value="reassignBroken" />
        <input type="hidden" name="repositoryId" value={repositoryId} />
        <Button
          type="submit"
          size="sm"
          variant="outline"
          loading={isReassigning}
        >
          Reassign
        </Button>
      </fetcher.Form>
    </span>
  )
}

function TeamSelect({
  repositoryId,
  currentTeamId,
  teams,
}: {
  repositoryId: string
  currentTeamId: string | null
  teams: TeamRow[]
}) {
  const fetcher = useFetcher()

  return (
    <Select
      defaultValue={currentTeamId ?? '__none__'}
      onValueChange={(value) => {
        const formData = new FormData()
        formData.set('intent', 'updateTeam')
        formData.set('repositoryId', repositoryId)
        formData.set('teamId', value === '__none__' ? '' : value)
        fetcher.submit(formData, { method: 'post' })
      }}
    >
      <SelectTrigger className="h-8 w-36">
        <SelectValue placeholder="Unassigned" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__none__">Unassigned</SelectItem>
        {teams.map((team) => (
          <SelectItem key={team.id} value={team.id}>
            {team.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export const createColumns = (
  orgSlug: string,
  teams: TeamRow[],
  integrationMethod: 'token' | 'github_app' | null,
): ColumnDef<RepositoryRow>[] => [
  {
    id: 'select',
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && 'indeterminate')
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label={`Select ${row.original.owner}/${row.original.repo}`}
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    id: 'repo',
    accessorFn: (row) => `${row.owner}/${row.repo}`,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Repository" />
    ),
    cell: ({ row }) => {
      const { id, owner, repo, provider } = row.original
      const repoUrl = match(provider)
        .with('github', () => `https://github.com/${owner}/${repo}`)
        .otherwise(() => '')
      const isBroken = isRepositoryBroken(row.original, integrationMethod)
      return (
        <span className="inline-flex items-center gap-1">
          <Link
            to={repoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-medium hover:underline"
          >
            {owner}/{repo}
            <ExternalLinkIcon className="h-3 w-3" />
          </Link>
          {isBroken && <NeedsReconnectionBadge repositoryId={id} />}
        </span>
      )
    },
    enableHiding: false,
  },
  {
    accessorKey: 'teamName',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Team" />
    ),
    cell: ({ row }) => (
      <TeamSelect
        repositoryId={row.original.id}
        currentTeamId={row.original.teamId}
        teams={teams}
      />
    ),
  },
  {
    accessorKey: 'releaseDetectionMethod',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Method" />
    ),
    cell: ({ row }) => (
      <Badge variant="outline" className="capitalize">
        {row.getValue('releaseDetectionMethod')}
      </Badge>
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
