import type { ColumnDef } from '@tanstack/react-table'
import { Avatar, AvatarFallback, AvatarImage } from '~/app/components/ui/avatar'
import dayjs from '~/app/libs/dayjs'
import type { GithubUserRow } from '../queries.server'
import { DataTableColumnHeader } from './data-table-column-header'
import { GithubUserRowActions } from './github-user-row-actions'

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
    cell: ({ row }) => <span>{row.getValue('displayName')}</span>,
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
