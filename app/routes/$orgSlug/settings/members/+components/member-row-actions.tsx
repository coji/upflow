import type { Row } from '@tanstack/react-table'
import { MoreHorizontalIcon, TrashIcon, UserCogIcon } from 'lucide-react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/app/components/ui/select'
import type { MemberRow } from '../queries.server'

export function MemberRowActions({ row }: { row: Row<MemberRow> }) {
  const member = row.original
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [roleOpen, setRoleOpen] = useState(false)
  const deleteFetcher = useFetcher()
  const roleFetcher = useFetcher()

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
          <DropdownMenuItem onClick={() => setRoleOpen(true)}>
            <UserCogIcon className="mr-2 h-4 w-4" />
            Change Role
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setDeleteOpen(true)}
            className="text-destructive"
          >
            <TrashIcon className="mr-2 h-4 w-4" />
            Remove
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Remove Member"
        desc={`Are you sure you want to remove ${member.name} from this organization?`}
        confirmText="Remove"
        destructive
        fetcher={deleteFetcher}
      >
        <input type="hidden" name="intent" value="removeMember" />
        <input type="hidden" name="memberId" value={member.id} />
      </ConfirmDialog>

      {roleOpen && (
        <ChangeRoleDialog
          open={roleOpen}
          onOpenChange={setRoleOpen}
          member={member}
          fetcher={roleFetcher}
        />
      )}
    </>
  )
}

function ChangeRoleDialog({
  open,
  onOpenChange,
  member,
  fetcher,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  member: MemberRow
  fetcher: ReturnType<typeof useFetcher>
}) {
  // Select の onValueChange が string を返すため string に広げる
  const [role, setRole] = useState<string>(member.role)

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Change Role"
      desc={`Change the role of ${member.name}.`}
      confirmText="Save"
      fetcher={fetcher}
    >
      <input type="hidden" name="intent" value="changeRole" />
      <input type="hidden" name="memberId" value={member.id} />
      <input type="hidden" name="role" value={role} />
      <Select value={role} onValueChange={setRole}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="owner">Owner</SelectItem>
          <SelectItem value="admin">Admin</SelectItem>
          <SelectItem value="member">Member</SelectItem>
        </SelectContent>
      </Select>
    </ConfirmDialog>
  )
}
