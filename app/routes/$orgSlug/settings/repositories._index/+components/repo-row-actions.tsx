import type { Row } from '@tanstack/react-table'
import {
  EyeIcon,
  MoreHorizontalIcon,
  SettingsIcon,
  TrashIcon,
} from 'lucide-react'
import { Link, href, useFetcher } from 'react-router'
import { ConfirmDialog } from '~/app/components/confirm-dialog'
import { Button } from '~/app/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '~/app/components/ui/dropdown-menu'
import type { RepositoryRow } from '../queries.server'

export function RepoRowActions({
  row,
  orgSlug,
}: {
  row: Row<RepositoryRow>
  orgSlug: string
}) {
  const repo = row.original
  const deleteFetcher = useFetcher()

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-8 w-8 p-0">
            <span className="sr-only">Open menu</span>
            <MoreHorizontalIcon className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link
              to={href('/:orgSlug/settings/repositories/:repository', {
                orgSlug,
                repository: repo.id,
              })}
            >
              <EyeIcon className="mr-2 h-4 w-4" />
              Pull Requests
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link
              to={href('/:orgSlug/settings/repositories/:repository/settings', {
                orgSlug,
                repository: repo.id,
              })}
            >
              <SettingsIcon className="mr-2 h-4 w-4" />
              Settings
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => {
              deleteFetcher.submit(
                { intent: 'confirm-delete', repositoryId: repo.id },
                { method: 'post' },
              )
            }}
            className="text-destructive"
          >
            <TrashIcon className="mr-2 h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        title="Delete Repository"
        desc={`Are you sure you want to delete ${repo.owner}/${repo.repo}? This action cannot be undone.`}
        confirmText="Delete"
        destructive
        fetcher={deleteFetcher}
      >
        <input type="hidden" name="intent" value="delete" />
        <input type="hidden" name="repositoryId" value={repo.id} />
      </ConfirmDialog>
    </>
  )
}
