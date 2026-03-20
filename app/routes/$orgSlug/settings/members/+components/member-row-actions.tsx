import type { Row } from '@tanstack/react-table'
import { MoreHorizontalIcon, TrashIcon, UserCogIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useFetcher } from 'react-router'
import { ConfirmDialog } from '~/app/components/confirm-dialog'
import { Button } from '~/app/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/app/components/ui/dialog'
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

export function MemberRowActions({
  row,
  currentMembershipId,
}: {
  row: Row<MemberRow>
  currentMembershipId?: string
}) {
  const member = row.original
  const isSelf = member.id === currentMembershipId
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
          <DropdownMenuItem onClick={() => setRoleOpen(true)} disabled={isSelf}>
            <UserCogIcon className="mr-2 h-4 w-4" />
            Change Role {isSelf && '(You)'}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              deleteFetcher.submit(
                { intent: 'confirm-removeMember', memberId: member.id },
                { method: 'post' },
              )
            }}
            className="text-destructive"
            disabled={isSelf}
          >
            <TrashIcon className="mr-2 h-4 w-4" />
            Remove {isSelf && '(You)'}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        title="Remove Member"
        desc={`Are you sure you want to remove ${member.name} from this organization?`}
        confirmText="Remove"
        destructive
        fetcher={deleteFetcher}
      >
        <input type="hidden" name="intent" value="removeMember" />
        <input type="hidden" name="memberId" value={member.id} />
      </ConfirmDialog>

      <ChangeRoleDialog
        open={roleOpen}
        onOpenChange={setRoleOpen}
        member={member}
        fetcher={roleFetcher}
      />
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
  const [role, setRole] = useState<string>(member.role)
  const isSubmitting = fetcher.state !== 'idle'

  // Reset form state when dialog opens
  useEffect(() => {
    if (open) {
      setRole(member.role)
    }
  }, [open, member])

  // Close on successful submission
  const prevData = useRef(fetcher.data)
  useEffect(() => {
    if (
      fetcher.state === 'idle' &&
      fetcher.data != null &&
      fetcher.data !== prevData.current
    ) {
      prevData.current = fetcher.data
      const res = fetcher.data as Record<string, unknown>
      if (!('error' in res)) {
        onOpenChange(false)
      }
    }
  }, [fetcher.state, fetcher.data, onOpenChange])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <fetcher.Form method="POST" className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Change Role</DialogTitle>
            <DialogDescription asChild>
              <div>{`Change the role of ${member.name}.`}</div>
            </DialogDescription>
          </DialogHeader>
          <input type="hidden" name="intent" value="changeRole" />
          <input type="hidden" name="memberId" value={member.id} />
          <input type="hidden" name="role" value={role} />
          <Select value={role} onValueChange={setRole}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="owner">Owner</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="member">Member</SelectItem>
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting}>
              Save
            </Button>
          </DialogFooter>
        </fetcher.Form>
      </DialogContent>
    </Dialog>
  )
}
