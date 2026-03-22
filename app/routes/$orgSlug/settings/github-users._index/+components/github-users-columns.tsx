import type { ColumnDef } from '@tanstack/react-table'
import { ExternalLinkIcon } from 'lucide-react'
import { useState } from 'react'
import { Link, useFetcher } from 'react-router'
import { ConfirmDialog } from '~/app/components/confirm-dialog'
import { EditableCell } from '~/app/components/editable-cell'
import { Avatar, AvatarFallback, AvatarImage } from '~/app/components/ui/avatar'
import { Badge } from '~/app/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/app/components/ui/select'
import dayjs from '~/app/libs/dayjs'
import { hasFetcherError } from '~/app/libs/fetcher-error'
import type { GithubUserRow } from '../queries.server'
import { DataTableColumnHeader } from './data-table-column-header'
import { GithubUserRowActions } from './github-user-row-actions'

const UNSET_VALUE = '__none__' as const
const USER_TYPES = [
  { value: 'User', label: 'User' },
  { value: 'Bot', label: 'Bot' },
] as const

function getConfirmDesc(login: string, pendingType: string): string {
  switch (pendingType) {
    case 'Bot':
      return `${login} を Bot に変更しますか？Bot はメトリクス集計から除外されます。`
    case 'User':
      return `${login} を User に変更しますか？`
    default:
      return `${login} のタイプ設定を解除しますか？`
  }
}

function UserTypeSelect({
  login,
  type,
}: {
  login: string
  type: string | null
}) {
  const fetcher = useFetcher()
  const [pendingType, setPendingType] = useState<string>(UNSET_VALUE)

  return (
    <>
      <Select
        value={type ?? UNSET_VALUE}
        onValueChange={(value) => {
          if (value !== (type ?? UNSET_VALUE)) {
            setPendingType(value)
            fetcher.submit(
              {
                intent: 'confirm-update-type',
                login,
                type: value === UNSET_VALUE ? '' : value,
              },
              { method: 'post' },
            )
          }
        }}
        disabled={fetcher.state !== 'idle'}
      >
        <SelectTrigger className="h-8 w-24">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={UNSET_VALUE}>-</SelectItem>
          {USER_TYPES.map((t) => (
            <SelectItem key={t.value} value={t.value}>
              {t.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <ConfirmDialog
        title="ユーザータイプの変更"
        desc={getConfirmDesc(login, pendingType)}
        confirmText="変更"
        destructive={pendingType === 'Bot'}
        fetcher={fetcher}
      >
        <input type="hidden" name="intent" value="update-type" />
        <input type="hidden" name="login" value={login} />
        <input
          type="hidden"
          name="type"
          value={pendingType === UNSET_VALUE ? '' : pendingType}
        />
      </ConfirmDialog>
    </>
  )
}

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
      pending={fetcher.state !== 'idle'}
      error={hasFetcherError(fetcher)}
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

export function createColumns(timezone: string): ColumnDef<GithubUserRow>[] {
  return [
    {
      accessorKey: 'login',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Login" />
      ),
      cell: ({ row }) => {
        const login = row.getValue<string>('login')
        return (
          <div className="flex items-center gap-2">
            <Avatar className="size-7">
              <AvatarImage
                src={`https://github.com/${login}.png`}
                alt={login}
              />
              <AvatarFallback className="text-xs">
                {login.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <Link
              to={`https://github.com/${login}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-medium hover:underline"
            >
              {login}
              <ExternalLinkIcon className="h-3 w-3" />
            </Link>
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
      accessorKey: 'type',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Type" />
      ),
      cell: ({ row }) => (
        <UserTypeSelect login={row.original.login} type={row.original.type} />
      ),
    },
    {
      accessorKey: 'isActive',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Login Status" />
      ),
      cell: ({ row }) => (
        <Badge variant={row.original.isActive ? 'default' : 'outline'}>
          {row.original.isActive ? 'Allowed' : 'Denied'}
        </Badge>
      ),
    },
    {
      accessorKey: 'lastActivityAt',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Last Activity" />
      ),
      cell: ({ row }) => {
        const value = row.getValue<string | null>('lastActivityAt')
        return (
          <div className="text-muted-foreground text-nowrap">
            {value ? dayjs.utc(value).tz(timezone).fromNow() : '-'}
          </div>
        )
      },
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
}
