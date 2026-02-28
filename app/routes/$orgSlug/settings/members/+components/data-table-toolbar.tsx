import { XIcon } from 'lucide-react'
import { SearchInput } from '~/app/components/search-input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/app/components/ui'
import { Button } from '~/app/components/ui/button'
import { useDataTableState } from '../+hooks/use-data-table-state'

export function DataTableToolbar() {
  const {
    queries,
    filters,
    updateQueries,
    updateFilters,
    isFiltered,
    resetFilters,
  } = useDataTableState()

  const currentRole = filters.role.length === 1 ? filters.role[0] : '__all__'

  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-1 flex-col-reverse items-start gap-y-2 sm:flex-row sm:items-center sm:space-x-2">
        <SearchInput
          value={queries.name}
          onChange={(value) => {
            updateQueries({ name: value })
          }}
          placeholder="Filter by name..."
          className="w-48 lg:w-64"
        />
        <Select
          value={currentRole}
          onValueChange={(value) => {
            updateFilters({ role: value === '__all__' ? [] : [value] })
          }}
        >
          <SelectTrigger className="h-8 w-32">
            <SelectValue placeholder="Role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All Roles</SelectItem>
            <SelectItem value="owner">Owner</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="member">Member</SelectItem>
          </SelectContent>
        </Select>
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
