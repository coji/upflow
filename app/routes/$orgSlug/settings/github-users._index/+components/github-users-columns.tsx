import type { ColumnDef } from '@tanstack/react-table'
import { useFetcher } from 'react-router'
import { EditableCell } from '~/app/components/editable-cell'
import { Avatar, AvatarFallback, AvatarImage } from '~/app/components/ui/avatar'
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

  return (
    <EditableCell
      value={displayName}
      onSave={(newValue) => {
        const formData = new FormData()
        formData.set('intent', 'update')
        formData.set('login', login)
        formData.set('displayName', newValue)
        fetcher.submit(formData, { method: 'post' })
      }}
    />
  )
}

function ActiveToggle({
  login,
  isActive,
  isSelf,
}: {
  login: string
  isActive: number
  isSelf: boolean
}) {
  const fetcher = useFetcher()
  const optimisticActive =
    fetcher.formData != null
      ? Number(fetcher.formData.get('isActive'))
      : isActive

  return (
    <Switch
      aria-label={`Toggle active status for ${login}`}
      checked={!!optimisticActive}
      disabled={fetcher.state !== 'idle' || (isSelf && !!optimisticActive)}
      onCheckedChange={() => {
        const formData = new FormData()
        formData.set('intent', 'toggle-active')
        formData.set('login', login)
        formData.set('isActive', String(optimisticActive ? 0 : 1))
        fetcher.submit(formData, { method: 'post' })
      }}
    />
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
    cell: ({ row, table }) => (
      <ActiveToggle
        login={row.original.login}
        isActive={row.original.isActive}
        isSelf={row.original.login === table.options.meta?.currentGithubLogin}
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
    cell: ({ row, table }) => (
      <GithubUserRowActions
        row={row}
        isSelf={row.original.login === table.options.meta?.currentGithubLogin}
      />
    ),
  },
]
