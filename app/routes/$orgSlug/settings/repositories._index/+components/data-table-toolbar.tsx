import { PlusIcon, XIcon } from 'lucide-react'
import { Link, href } from 'react-router'
import { SearchInput } from '~/app/components/search-input'
import { TeamFilter } from '~/app/components/team-filter'
import { Button } from '~/app/components/ui/button'
import { useDataTableState } from '../+hooks/use-data-table-state'
import type { TeamRow } from '../../teams._index/queries.server'

interface DataTableToolbarProps {
  teams: TeamRow[]
  orgSlug: string
  canAddRepositories: boolean
}

export function DataTableToolbar({
  teams,
  orgSlug,
  canAddRepositories,
}: DataTableToolbarProps) {
  const { queries, updateQueries, isFiltered, resetFilters } =
    useDataTableState()

  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-1 flex-col-reverse items-start gap-y-2 sm:flex-row sm:items-center sm:space-x-2">
        <SearchInput
          value={queries.repo}
          onChange={(value) => {
            updateQueries({ repo: value })
          }}
          placeholder="Filter repositories..."
          className="w-48 lg:w-64"
        />
        <TeamFilter teams={teams} />
        {isFiltered && (
          <Button
            variant="ghost"
            onClick={() => resetFilters()}
            className="h-8 px-2 lg:px-3"
          >
            Reset
            <XIcon className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>
      {canAddRepositories ? (
        <Button asChild>
          <Link to={href('/:orgSlug/settings/repositories/add', { orgSlug })}>
            <PlusIcon className="h-4 w-4" />
            Add
          </Link>
        </Button>
      ) : null}
    </div>
  )
}
