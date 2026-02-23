import { XIcon } from 'lucide-react'
import { SearchInput } from '~/app/components/search-input'
import { Button } from '~/app/components/ui/button'
import { useDataTableState } from '../+hooks/use-data-table-state'

export function DataTableToolbar() {
  const { queries, updateQueries, isFiltered, resetFilters } =
    useDataTableState()

  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-1 flex-col-reverse items-start gap-y-2 sm:flex-row sm:items-center sm:space-x-2">
        <SearchInput
          value={queries.search}
          onChange={(value) => {
            updateQueries({ search: value })
          }}
          placeholder="Filter GitHub users..."
          className="w-48 lg:w-64"
        />
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
    </div>
  )
}
