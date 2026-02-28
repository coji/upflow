import type { Table } from '@tanstack/react-table'
import { LoaderIcon, XIcon } from 'lucide-react'
import { useEffect } from 'react'
import { useFetcher } from 'react-router'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/app/components/ui'
import { Button } from '~/app/components/ui/button'
import { Separator } from '~/app/components/ui/separator'
import type { TeamRow } from '../../teams._index/queries.server'
import type { RepositoryRow } from '../queries.server'

interface DataTableFloatingBarProps {
  table: Table<RepositoryRow>
  teams: TeamRow[]
}

export function DataTableFloatingBar({
  table,
  teams,
}: DataTableFloatingBarProps) {
  const selectedRows = table.getFilteredSelectedRowModel().rows
  const selectedCount = selectedRows.length

  const fetcher = useFetcher({ key: 'bulk-update-team' })
  const isSubmitting = fetcher.state !== 'idle'

  useEffect(() => {
    if (fetcher.data && fetcher.state === 'idle') {
      table.resetRowSelection()
    }
  }, [fetcher.data, fetcher.state, table])

  if (selectedCount === 0) return null

  const selectedIds = selectedRows.map((row) => row.original.id)

  const handleBulkUpdateTeam = (teamId: string) => {
    const formData = new FormData()
    formData.set('intent', 'bulkUpdateTeam')
    for (const id of selectedIds) {
      formData.append('repositoryIds', id)
    }
    formData.set('teamId', teamId === '__none__' ? '' : teamId)
    fetcher.submit(formData, { method: 'post' })
  }

  return (
    <div className="fixed inset-x-0 bottom-6 z-50 mx-4 flex justify-center sm:mx-auto sm:max-w-md">
      <div className="bg-background flex w-full items-center gap-2 rounded-lg border px-3 py-2 shadow-lg">
        <span className="text-muted-foreground min-w-0 flex-1 text-sm font-medium whitespace-nowrap">
          {selectedCount} selected
        </span>

        <div className="flex shrink-0 items-center gap-1">
          <Select onValueChange={handleBulkUpdateTeam} disabled={isSubmitting}>
            <SelectTrigger className="h-8 w-32">
              {isSubmitting ? (
                <LoaderIcon className="h-4 w-4 animate-spin" />
              ) : (
                <SelectValue placeholder="Set Team" />
              )}
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

          <Separator orientation="vertical" className="mx-1 h-5" />

          <Button
            variant="ghost"
            size="sm"
            onClick={() => table.resetRowSelection()}
            disabled={isSubmitting}
          >
            <XIcon className="h-4 w-4" />
            Deselect
          </Button>
        </div>
      </div>
    </div>
  )
}
