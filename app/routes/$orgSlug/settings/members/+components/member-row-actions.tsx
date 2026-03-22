import { getFormProps, getInputProps, useForm } from '@conform-to/react'
import { parseWithZod } from '@conform-to/zod/v4'
import type { Row } from '@tanstack/react-table'
import { MoreHorizontalIcon, TrashIcon, UserCogIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
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
import type { action } from '../index'
import { changeRoleSchema } from '../index'
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
      />
    </>
  )
}

function ChangeRoleDialog({
  open,
  onOpenChange,
  member,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  member: MemberRow
}) {
  const fetcher = useFetcher<typeof action>()
  const isSubmitting = fetcher.state !== 'idle'

  const [form, fields] = useForm({
    lastResult: fetcher.data?.lastResult ?? undefined,
    defaultValue: {
      intent: 'changeRole',
      memberId: member.id,
      role: member.role,
    },
    onValidate: ({ formData }) =>
      parseWithZod(formData, { schema: changeRoleSchema }),
  })

  // Close on successful submission
  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data?.ok === true) {
      onOpenChange(false)
    }
  }, [fetcher.state, fetcher.data, onOpenChange])

  // Reset form and fetcher when dialog opens
  // biome-ignore lint/correctness/useExhaustiveDependencies: form and fetcher are unstable references from hooks, but we only want this to run when open changes
  useEffect(() => {
    if (open) {
      form.reset()
      fetcher.reset()
    }
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <fetcher.Form
          method="POST"
          {...getFormProps(form)}
          className="grid gap-4"
        >
          <DialogHeader>
            <DialogTitle>Change Role</DialogTitle>
            <DialogDescription asChild>
              <div>{`Change the role of ${member.name}.`}</div>
            </DialogDescription>
          </DialogHeader>
          {form.errors && form.errors.length > 0 && (
            <p className="text-destructive text-sm">{form.errors.join(', ')}</p>
          )}
          <input
            {...getInputProps(fields.intent, { type: 'hidden' })}
            key={fields.intent.key}
          />
          <input
            {...getInputProps(fields.memberId, { type: 'hidden' })}
            key={fields.memberId.key}
          />
          <Select
            key={fields.role.key}
            name={fields.role.name}
            defaultValue={fields.role.initialValue}
          >
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
