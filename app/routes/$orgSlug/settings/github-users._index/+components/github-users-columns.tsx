import type { ColumnDef } from '@tanstack/react-table'
import { ExternalLinkIcon } from 'lucide-react'
import { Link, useFetcher } from 'react-router'
import { EditableCell } from '~/app/components/editable-cell'
import { Avatar, AvatarFallback, AvatarImage } from '~/app/components/ui/avatar'
import { Badge } from '~/app/components/ui/badge'
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
      pending={fetcher.state !== 'idle'}
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

export const columns: ColumnDef<GithubUserRow>[] = [
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
            <AvatarImage src={`https://github.com/${login}.png`} alt={login} />
            <AvatarFallback className="text-xs">
              {login.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <Link
            to={`https://github.com/${login}`}
            target="_blank"
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
    accessorKey: 'isActive',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Login" />
    ),
    cell: ({ row }) => (
      <Badge variant={row.original.isActive ? 'default' : 'outline'}>
        {row.original.isActive ? 'Allowed' : 'Denied'}
      </Badge>
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
