import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon } from 'lucide-react'
import { useSearchParams } from 'react-router'
import {
  PageHeader,
  PageHeaderActions,
  PageHeaderDescription,
  PageHeaderHeading,
  PageHeaderTitle,
} from '~/app/components/layout/page-header'
import { TeamFilter } from '~/app/components/team-filter'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/app/components/ui/select'
import { Stack } from '~/app/components/ui/stack'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/app/components/ui/table'
import { requireOrgMember } from '~/app/libs/auth.server'
import dayjs from '~/app/libs/dayjs'
import { listTeams } from '~/app/routes/$orgSlug/settings/teams._index/queries.server'
import {
  DataTablePagination,
  type PaginationProps,
} from './+components/data-table-pagination'
import { feedbackColumns } from './+components/feedback-columns'
import { FeedbackSummaryCards } from './+components/feedback-summary-cards'
import {
  getFeedbackSummary,
  listFilteredFeedbacks,
} from './+functions/queries.server'
import { useDataTableState } from './+hooks/use-data-table-state'
import type { Route } from './+types/index'

const PERIOD_OPTIONS = [
  { value: '1', label: '1 month' },
  { value: '3', label: '3 months' },
  { value: '6', label: '6 months' },
  { value: '12', label: '1 year' },
  { value: 'all', label: 'All time' },
] as const

const VALID_PERIODS = [1, 3, 6, 12]

export const loader = async ({ request, params }: Route.LoaderArgs) => {
  const { organization } = await requireOrgMember(request, params.orgSlug)

  const url = new URL(request.url)
  const teamParam = url.searchParams.get('team') || undefined
  const periodParam = url.searchParams.get('period')
  const periodMonths =
    periodParam === 'all'
      ? 'all'
      : VALID_PERIODS.includes(Number(periodParam))
        ? Number(periodParam)
        : 1

  const sinceDate =
    periodMonths === 'all'
      ? '2000-01-01T00:00:00.000Z'
      : dayjs().subtract(periodMonths, 'month').startOf('day').toISOString()

  const page = Number(url.searchParams.get('page') || '1')
  const perPage = Number(url.searchParams.get('per_page') || '20')
  const sortBy = url.searchParams.get('sort_by') || undefined
  const sortOrder =
    (url.searchParams.get('sort_order') as 'asc' | 'desc') || 'desc'

  const [feedbackResult, summary, teams] = await Promise.all([
    listFilteredFeedbacks({
      organizationId: organization.id,
      teamId: teamParam,
      sinceDate,
      currentPage: page,
      pageSize: perPage,
      sortBy,
      sortOrder,
    }),
    getFeedbackSummary({
      organizationId: organization.id,
      teamId: teamParam,
      sinceDate,
    }),
    listTeams(organization.id),
  ])

  return {
    feedbacks: feedbackResult.data,
    pagination: feedbackResult.pagination,
    summary,
    teams,
    periodMonths,
  }
}

export default function FeedbacksPage({
  loaderData: { feedbacks, pagination, summary, teams, periodMonths },
}: Route.ComponentProps) {
  const [, setSearchParams] = useSearchParams()
  const { sort, updateSort } = useDataTableState()

  const table = useReactTable({
    data: feedbacks,
    columns: feedbackColumns,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    manualPagination: true,
  })

  return (
    <Stack gap="6">
      <PageHeader>
        <PageHeaderHeading>
          <PageHeaderTitle>Feedbacks</PageHeaderTitle>
          <PageHeaderDescription>
            PR size corrections by team members
          </PageHeaderDescription>
        </PageHeaderHeading>
        <PageHeaderActions>
          <Select
            value={String(periodMonths)}
            onValueChange={(value) => {
              setSearchParams((prev) => {
                prev.set('period', value)
                prev.delete('page')
                return prev
              })
            }}
          >
            <SelectTrigger className="w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIOD_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <TeamFilter teams={teams} />
        </PageHeaderActions>
      </PageHeader>

      <FeedbackSummaryCards summary={summary} />

      <div className="space-y-4">
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    const canSort = header.column.getCanSort()
                    const isSorted = sort.sort_by === header.column.id
                    return (
                      <TableHead
                        key={header.id}
                        className={canSort ? 'cursor-pointer select-none' : ''}
                        onClick={
                          canSort
                            ? () => {
                                if (isSorted) {
                                  updateSort({
                                    sort_by: header.column.id,
                                    sort_order:
                                      sort.sort_order === 'asc'
                                        ? 'desc'
                                        : 'asc',
                                  })
                                } else {
                                  updateSort({
                                    sort_by: header.column.id,
                                    sort_order: 'desc',
                                  })
                                }
                              }
                            : undefined
                        }
                      >
                        <div className="flex items-center gap-1">
                          {header.isPlaceholder
                            ? null
                            : flexRender(
                                header.column.columnDef.header,
                                header.getContext(),
                              )}
                          {canSort &&
                            (isSorted ? (
                              sort.sort_order === 'asc' ? (
                                <ArrowUpIcon className="h-4 w-4" />
                              ) : (
                                <ArrowDownIcon className="h-4 w-4" />
                              )
                            ) : (
                              <ArrowUpDownIcon className="text-muted-foreground h-4 w-4" />
                            ))}
                        </div>
                      </TableHead>
                    )
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.length > 0 ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={feedbackColumns.length}
                    className="h-24 text-center"
                  >
                    No feedbacks found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <DataTablePagination pagination={pagination as PaginationProps} />
      </div>
    </Stack>
  )
}
