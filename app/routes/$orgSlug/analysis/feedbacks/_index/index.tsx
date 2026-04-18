import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon } from 'lucide-react'
import { useMemo } from 'react'
import { useSearchParams } from 'react-router'
import {
  PageHeader,
  PageHeaderActions,
  PageHeaderDescription,
  PageHeaderHeading,
  PageHeaderTitle,
} from '~/app/components/layout/page-header'
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
import { calcSinceDate } from '~/app/libs/date-utils'
import { isOrgAdmin } from '~/app/libs/member-role'
import {
  computeExcludedCount,
  loadPrFilterState,
} from '~/app/libs/pr-title-filter.server'
import {
  orgContext,
  teamContext,
  timezoneContext,
} from '~/app/middleware/context'
import { PrTitleFilterStatus } from '~/app/routes/$orgSlug/+components/pr-title-filter-status'
import { DataTablePagination } from './+components/data-table-pagination'
import { createFeedbackColumns } from './+components/feedback-columns'
import { FeedbackSummaryCards } from './+components/feedback-summary-cards'
import {
  countFeedbacks,
  getFeedbackSummary,
  listFilteredFeedbacks,
} from './+functions/queries.server'
import { useDataTableState } from './+hooks/use-data-table-state'
import type { Route } from './+types/index'

export const handle = {
  breadcrumb: () => ({
    label: 'Feedbacks',
  }),
}

const PERIOD_OPTIONS = [
  { value: '1', label: '1 month' },
  { value: '3', label: '3 months' },
  { value: '6', label: '6 months' },
  { value: '12', label: '1 year' },
  { value: 'all', label: 'All time' },
] as const

const VALID_PERIODS = [1, 3, 6, 12]

export const loader = async ({ request, context }: Route.LoaderArgs) => {
  const { organization, membership } = context.get(orgContext)
  const timezone = context.get(timezoneContext)

  const url = new URL(request.url)
  const teamParam = context.get(teamContext) ?? undefined
  const periodParam = url.searchParams.get('period')
  const periodMonths =
    periodParam === 'all'
      ? 'all'
      : VALID_PERIODS.includes(Number(periodParam))
        ? Number(periodParam)
        : 1

  const sinceDate = calcSinceDate(periodMonths, timezone)

  const page = Number(url.searchParams.get('page') || '1')
  const perPage = Number(url.searchParams.get('per_page') || '20')
  const sortBy = url.searchParams.get('sort_by') || undefined
  const sortOrder =
    (url.searchParams.get('sort_order') as 'asc' | 'desc') || 'desc'

  const filter = await loadPrFilterState(request, organization.id)

  const [feedbackResult, summary, excludedCount] = await Promise.all([
    listFilteredFeedbacks({
      organizationId: organization.id,
      teamId: teamParam,
      sinceDate,
      currentPage: page,
      pageSize: perPage,
      sortBy,
      sortOrder,
      normalizedPatterns: filter.normalizedPatterns,
    }),
    getFeedbackSummary({
      organizationId: organization.id,
      teamId: teamParam,
      sinceDate,
      normalizedPatterns: filter.normalizedPatterns,
    }),
    computeExcludedCount(filter, (patterns) =>
      countFeedbacks({
        organizationId: organization.id,
        teamId: teamParam,
        sinceDate,
        normalizedPatterns: patterns,
      }),
    ),
  ])

  return {
    feedbacks: feedbackResult.data,
    pagination: feedbackResult.pagination,
    summary,
    periodMonths,
    excludedCount,
    filterActive: filter.filterActive,
    showFiltered: filter.showFiltered,
    hasAnyEnabledPattern: filter.hasAnyEnabledPattern,
    isAdmin: isOrgAdmin(membership.role),
  }
}

export default function FeedbacksPage({
  loaderData: {
    feedbacks,
    pagination,
    summary,
    periodMonths,
    excludedCount,
    filterActive,
    showFiltered,
    hasAnyEnabledPattern,
    isAdmin,
  },
}: Route.ComponentProps) {
  const [, setSearchParams] = useSearchParams()
  const { sort, updateSort } = useDataTableState()

  const columns = useMemo(() => createFeedbackColumns(isAdmin), [isAdmin])
  const table = useReactTable({
    data: feedbacks,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    manualPagination: true,
  })

  return (
    <Stack>
      <PageHeader>
        <PageHeaderHeading>
          <PageHeaderTitle>Feedbacks</PageHeaderTitle>
          <PageHeaderDescription>
            PR size corrections by team members
          </PageHeaderDescription>
        </PageHeaderHeading>
        <PageHeaderActions>
          <PrTitleFilterStatus
            excludedCount={excludedCount}
            filterActive={filterActive}
            showFiltered={showFiltered}
            hasAnyEnabledPattern={hasAnyEnabledPattern}
            isAdmin={isAdmin}
          />
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
        </PageHeaderActions>
      </PageHeader>

      <div className="space-y-6">
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
                          className={
                            canSort ? 'cursor-pointer select-none' : ''
                          }
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
                      colSpan={columns.length}
                      className="h-24 text-center"
                    >
                      No feedbacks found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <DataTablePagination pagination={pagination} />
        </div>
      </div>
    </Stack>
  )
}
