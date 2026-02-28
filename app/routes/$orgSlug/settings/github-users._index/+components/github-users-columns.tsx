import type { ColumnDef } from '@tanstack/react-table'
import { useState } from 'react'
import { useFetcher } from 'react-router'
import { Avatar, AvatarFallback, AvatarImage } from '~/app/components/ui/avatar'
import { Input } from '~/app/components/ui/input'
import { Switch } from '~/app/components/ui/switch'
import dayjs from '~/app/libs/dayjs'
import type { GithubUserRow } from '../queries.server'
import { DataTableColumnHeader } from './data-table-column-header'
import { GithubUserRowActions } from './github-user-row-actions'

function EditableDisplayName({
  login,
  displayName,
}: {
  login: string
  displayName: string
}) {
  const fetcher = useFetcher()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(displayName)

  const submit = () => {
    if (value.trim() && value !== displayName) {
      const formData = new FormData()
      formData.set('intent', 'update')
      formData.set('login', login)
      formData.set('displayName', value.trim())
      fetcher.submit(formData, { method: 'post' })
    } else {
      setValue(displayName)
    }
    setEditing(false)
  }

  if (editing) {
    return (
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={submit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit()
          if (e.key === 'Escape') {
            setValue(displayName)
            setEditing(false)
          }
        }}
        className="h-7 w-40"
        autoFocus
      />
    )
  }

  return (
    <button
      type="button"
      onClick={() => {
        setValue(displayName)
        setEditing(true)
      }}
      className="hover:bg-muted cursor-pointer rounded px-1 py-0.5 text-left"
      title="クリックして編集"
    >
      {displayName}
    </button>
  )
}

function ActiveToggle({
  login,
  isActive,
}: {
  login: string
  isActive: number
}) {
  const fetcher = useFetcher()
  const optimisticActive =
    fetcher.formData != null
      ? Number(fetcher.formData.get('isActive'))
      : isActive

  return (
    <fetcher.Form method="post">
      <input type="hidden" name="intent" value="toggle-active" />
      <input type="hidden" name="login" value={login} />
      <input type="hidden" name="isActive" value={optimisticActive ? 0 : 1} />
      <Switch
        checked={!!optimisticActive}
        onCheckedChange={() => {
          const formData = new FormData()
          formData.set('intent', 'toggle-active')
          formData.set('login', login)
          formData.set('isActive', String(optimisticActive ? 0 : 1))
          fetcher.submit(formData, { method: 'post' })
        }}
      />
    </fetcher.Form>
  )
}

export const columns: ColumnDef<GithubUserRow>[] = [
  {
    accessorKey: 'login',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Login" />
    ),
    cell: ({ row }) => {
      const login = row.getValue<string>('login')
      const pictureUrl = row.original.pictureUrl
      return (
        <div className="flex items-center gap-2">
          <Avatar className="size-7">
            <AvatarImage src={pictureUrl ?? undefined} alt={login} />
            <AvatarFallback className="text-xs">
              {login.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="font-medium">{login}</span>
        </div>
      )
    },
    enableHiding: false,
  },
  {
    accessorKey: 'displayName',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Display Name" />
    ),
    cell: ({ row }) => (
      <EditableDisplayName
        login={row.original.login}
        displayName={row.getValue('displayName')}
      />
    ),
  },
  {
    accessorKey: 'name',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Name" />
    ),
    cell: ({ row }) => (
      <span className="text-muted-foreground">{row.getValue('name')}</span>
    ),
  },
  {
    accessorKey: 'email',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Email" />
    ),
    cell: ({ row }) => (
      <span className="text-muted-foreground">{row.getValue('email')}</span>
    ),
  },
  {
    accessorKey: 'isActive',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Active" />
    ),
    cell: ({ row }) => (
      <ActiveToggle
        login={row.original.login}
        isActive={row.original.isActive}
      />
    ),
  },
  {
    accessorKey: 'createdAt',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Created" />
    ),
    cell: ({ row }) => (
      <div className="text-muted-foreground text-nowrap">
        {dayjs.utc(row.getValue('createdAt')).format('YYYY-MM-DD')}
      </div>
    ),
  },
  {
    id: 'actions',
    cell: ({ row }) => <GithubUserRowActions row={row} />,
  },
]
