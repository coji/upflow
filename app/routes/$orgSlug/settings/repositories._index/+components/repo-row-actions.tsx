import type { Row } from '@tanstack/react-table'
import { EyeIcon, MoreHorizontalIcon, SettingsIcon } from 'lucide-react'
import { Link, href } from 'react-router'
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

  return (
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
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
