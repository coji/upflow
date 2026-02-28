import type { ColumnDef } from '@tanstack/react-table'
import { Avatar, AvatarFallback, AvatarImage } from '~/app/components/ui/avatar'
import { Badge } from '~/app/components/ui/badge'
import dayjs from '~/app/libs/dayjs'
import type { MemberRow } from '../queries.server'
import { DataTableColumnHeader } from './data-table-column-header'
import { MemberRowActions } from './member-row-actions'

export const columns: ColumnDef<MemberRow>[] = [
  {
    accessorKey: 'name',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Name" />
    ),
    cell: ({ row }) => {
      const name = row.getValue<string>('name')
      const image = row.original.image
      return (
        <div className="flex items-center gap-2">
          <Avatar className="size-7">
            <AvatarImage src={image ?? undefined} alt={name} />
            <AvatarFallback className="text-xs">
              {name
                .split(' ')
                .map((n) => n[0])
                .join('')}
            </AvatarFallback>
          </Avatar>
          <span className="font-medium">{name}</span>
        </div>
      )
    },
    enableHiding: false,
  },
  {
    accessorKey: 'email',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Email" />
    ),
    cell: ({ row }) => (
      <div className="text-nowrap">{row.getValue('email')}</div>
    ),
  },
  {
    accessorKey: 'role',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Role" />
    ),
    cell: ({ row }) => {
      const role = row.getValue<string>('role')
      return (
        <Badge
          variant={role === 'owner' ? 'default' : 'secondary'}
          className="capitalize"
        >
          {role}
        </Badge>
      )
    },
    enableSorting: false,
  },
  {
    accessorKey: 'createdAt',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Joined" />
    ),
    cell: ({ row }) => (
      <div className="text-muted-foreground text-nowrap">
        {dayjs.utc(row.getValue('createdAt')).format('YYYY-MM-DD')}
      </div>
    ),
  },
  {
    id: 'actions',
    cell: ({ row }) => <MemberRowActions row={row} />,
  },
]
