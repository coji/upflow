import type { Row } from '@tanstack/react-table'
import {
  LogInIcon,
  LogOutIcon,
  MoreHorizontalIcon,
  TrashIcon,
} from 'lucide-react'
import { useState } from 'react'
import { useFetcher } from 'react-router'
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
import type { GithubUserRow } from '../queries.server'

export function GithubUserRowActions({
  row,
  isSelf,
}: {
  row: Row<GithubUserRow>
  isSelf: boolean
}) {
  const user = row.original
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [revokeOpen, setRevokeOpen] = useState(false)
  const deleteFetcher = useFetcher()
  const toggleFetcher = useFetcher()

  const handleAllowLogin = () => {
    const formData = new FormData()
    formData.set('intent', 'toggle-active')
    formData.set('login', user.login)
    formData.set('isActive', '1')
    toggleFetcher.submit(formData, { method: 'post' })
  }

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
          {user.isActive ? (
            <DropdownMenuItem
              onClick={() => setRevokeOpen(true)}
              disabled={isSelf}
            >
              <LogOutIcon className="mr-2 h-4 w-4" />
              Revoke Login {isSelf && '(You)'}
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={handleAllowLogin}>
              <LogInIcon className="mr-2 h-4 w-4" />
              Allow Login
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setDeleteOpen(true)}
            className="text-destructive"
            disabled={isSelf}
          >
            <TrashIcon className="mr-2 h-4 w-4" />
            Delete {isSelf && '(You)'}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={revokeOpen}
        onOpenChange={setRevokeOpen}
        title="Revoke Login"
        desc={`Are you sure you want to revoke login for ${user.login}? They will be logged out immediately and won't be able to log in again until re-allowed.`}
        confirmText="Revoke"
        destructive
        fetcher={toggleFetcher}
      >
        <input type="hidden" name="intent" value="toggle-active" />
        <input type="hidden" name="login" value={user.login} />
        <input type="hidden" name="isActive" value="0" />
      </ConfirmDialog>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete GitHub User"
        desc={`Are you sure you want to delete ${user.login}?`}
        confirmText="Delete"
        destructive
        fetcher={deleteFetcher}
      >
        <input type="hidden" name="intent" value="delete" />
        <input type="hidden" name="login" value={user.login} />
      </ConfirmDialog>
    </>
  )
}
