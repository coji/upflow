import type { Row } from '@tanstack/react-table'
import { MoreHorizontalIcon, PencilIcon, TrashIcon } from 'lucide-react'
import { useState } from 'react'
import { useFetcher } from 'react-router'
import { ConfirmDialog } from '~/app/components/confirm-dialog'
import { FormDialog } from '~/app/components/form-dialog'
import { Button } from '~/app/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '~/app/components/ui/dropdown-menu'
import { Input } from '~/app/components/ui/input'
import { Label } from '~/app/components/ui/label'
import type { GithubUserRow } from '../queries.server'

export function GithubUserRowActions({ row }: { row: Row<GithubUserRow> }) {
  const user = row.original
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const deleteFetcher = useFetcher()
  const editFetcher = useFetcher()

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
          <DropdownMenuItem onClick={() => setEditOpen(true)}>
            <PencilIcon className="mr-2 h-4 w-4" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setDeleteOpen(true)}
            className="text-destructive"
          >
            <TrashIcon className="mr-2 h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

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

      {editOpen && (
        <EditGithubUserDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          user={user}
          fetcher={editFetcher}
        />
      )}
    </>
  )
}

function EditGithubUserDialog({
  open,
  onOpenChange,
  user,
  fetcher,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: GithubUserRow
  fetcher: ReturnType<typeof useFetcher>
}) {
  const [displayName, setDisplayName] = useState(user.displayName)
  const [name, setName] = useState(user.name ?? '')
  const [email, setEmail] = useState(user.email ?? '')

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Edit GitHub User"
      desc={`Edit details for ${user.login}.`}
      confirmText="Save"
      fetcher={fetcher}
    >
      <input type="hidden" name="intent" value="update" />
      <input type="hidden" name="login" value={user.login} />
      <div className="space-y-3">
        <div>
          <Label htmlFor="displayName">Display Name</Label>
          <Input
            id="displayName"
            name="displayName"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
      </div>
    </FormDialog>
  )
}
