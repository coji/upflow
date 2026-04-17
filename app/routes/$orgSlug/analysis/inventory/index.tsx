import { useSearchParams } from 'react-router'
import {
  PageHeader,
  PageHeaderActions,
  PageHeaderDescription,
  PageHeaderHeading,
  PageHeaderTitle,
} from '~/app/components/layout/page-header'
import { HStack, Label, Stack } from '~/app/components/ui'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/app/components/ui/select'
import { Switch } from '~/app/components/ui/switch'
import { calcSinceDate } from '~/app/libs/date-utils'
import dayjs from '~/app/libs/dayjs'
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
import { getOrgCachedData } from '~/app/services/cache.server'
import { OpenPRInventoryChart } from './+components/open-pr-inventory-chart'
import { aggregateWeeklyOpenPRInventory } from './+functions/aggregate'
import {
  countOpenPRInventory,
  getOpenPRInventoryRawData,
} from './+functions/queries.server'
import type { Route } from './+types/index'

export const handle = {
  breadcrumb: () => ({ label: 'Inventory' }),
}

const PERIOD_OPTIONS = [
  { value: '1', label: '1 month' },
  { value: '3', label: '3 months' },
  { value: '6', label: '6 months' },
  { value: '12', label: '1 year' },
] as const

const VALID_PERIODS = [1, 3, 6, 12] as const

export const loader = async ({ request, context }: Route.LoaderArgs) => {
  const { organization, membership } = context.get(orgContext)
  const timezone = context.get(timezoneContext)

  const url = new URL(request.url)
  const teamParam = context.get(teamContext)
  const periodParam = url.searchParams.get('period') || null
  const periodMonths = VALID_PERIODS.includes(
    Number(periodParam) as (typeof VALID_PERIODS)[number],
  )
    ? Number(periodParam)
    : 6

  const excludeBots = url.searchParams.get('excludeBots') !== '0'
  const unreviewedOnly = url.searchParams.get('unreviewedOnly') === '1'

  const sinceDate = calcSinceDate(periodMonths, timezone)

  const now = dayjs.utc().toISOString()

  const filter = await loadPrFilterState(request, organization.id)

  const sf = filter.showFiltered ? 't' : 'f'
  const cacheKey = `inventory:${teamParam ?? 'all'}:${periodMonths}:${excludeBots ? 'exclude-bots' : 'include-bots'}:sf=${sf}`

  const FIVE_MINUTES = 5 * 60 * 1000

  const [rawRows, excludedCount] = await Promise.all([
    getOrgCachedData(
      organization.id,
      cacheKey,
      () =>
        getOpenPRInventoryRawData(
          organization.id,
          sinceDate,
          now,
          teamParam,
          excludeBots,
          filter.normalizedPatterns,
        ),
      FIVE_MINUTES,
    ),
    computeExcludedCount(filter, (patterns) =>
      countOpenPRInventory(
        organization.id,
        sinceDate,
        now,
        teamParam,
        excludeBots,
        patterns,
      ),
    ),
  ])

  return {
    rawRows,
    sinceDate,
    now,
    timezone,
    periodMonths,
    excludeBots,
    unreviewedOnly,
    excludedCount,
    filterActive: filter.filterActive,
    showFiltered: filter.showFiltered,
    isAdmin: isOrgAdmin(membership.role),
  }
}

export const clientLoader = async ({
  serverLoader,
}: Route.ClientLoaderArgs) => {
  const {
    rawRows,
    sinceDate,
    now,
    timezone,
    periodMonths,
    excludeBots,
    unreviewedOnly,
    excludedCount,
    filterActive,
    showFiltered,
    isAdmin,
  } = await serverLoader()

  return {
    inventory: aggregateWeeklyOpenPRInventory(
      rawRows,
      sinceDate,
      now,
      timezone,
      unreviewedOnly,
    ),
    periodMonths,
    excludeBots,
    unreviewedOnly,
    excludedCount,
    filterActive,
    showFiltered,
    isAdmin,
  }
}
clientLoader.hydrate = true as const

export function HydrateFallback() {
  return (
    <Stack>
      <PageHeader>
        <PageHeaderHeading>
          <PageHeaderTitle>Open PR Inventory</PageHeaderTitle>
          <PageHeaderDescription>Loading...</PageHeaderDescription>
        </PageHeaderHeading>
      </PageHeader>
    </Stack>
  )
}

export default function InventoryPage({
  loaderData: {
    inventory,
    periodMonths,
    excludeBots,
    unreviewedOnly,
    excludedCount,
    filterActive,
    showFiltered,
    isAdmin,
  },
}: Route.ComponentProps) {
  const [, setSearchParams] = useSearchParams()

  return (
    <Stack>
      <PageHeader>
        <PageHeaderHeading>
          <PageHeaderTitle>Open PR Inventory</PageHeaderTitle>
          <PageHeaderDescription>
            Weekly snapshots of open PR backlog by age—see how review inventory
            stacks up across time.
          </PageHeaderDescription>
        </PageHeaderHeading>
        <PageHeaderActions className="flex flex-wrap">
          <PrTitleFilterStatus
            excludedCount={excludedCount}
            filterActive={filterActive}
            showFiltered={showFiltered}
            isAdmin={isAdmin}
          />
          <Select
            value={String(periodMonths)}
            onValueChange={(value) => {
              setSearchParams((prev) => {
                if (value === '6') {
                  prev.delete('period')
                } else {
                  prev.set('period', value)
                }
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
          <HStack className="rounded-md border px-3 py-2">
            <Label htmlFor="exclude-bots">Exclude bots</Label>
            <Switch
              id="exclude-bots"
              checked={excludeBots}
              onCheckedChange={(checked) => {
                setSearchParams((prev) => {
                  if (checked) {
                    prev.delete('excludeBots')
                  } else {
                    prev.set('excludeBots', '0')
                  }
                  return prev
                })
              }}
            />
          </HStack>
          <HStack className="rounded-md border px-3 py-2">
            <Label htmlFor="unreviewed-only">Unreviewed only</Label>
            <Switch
              id="unreviewed-only"
              checked={unreviewedOnly}
              onCheckedChange={(checked) => {
                setSearchParams((prev) => {
                  if (checked) {
                    prev.set('unreviewedOnly', '1')
                  } else {
                    prev.delete('unreviewedOnly')
                  }
                  return prev
                })
              }}
            />
          </HStack>
        </PageHeaderActions>
      </PageHeader>

      <OpenPRInventoryChart data={inventory} />
    </Stack>
  )
}
