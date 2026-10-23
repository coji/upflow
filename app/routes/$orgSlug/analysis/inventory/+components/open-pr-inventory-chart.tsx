import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/app/components/ui/card'
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '~/app/components/ui/chart'
import { useTimezone } from '~/app/hooks/use-timezone'
import dayjs from '~/app/libs/dayjs'
import { AGE_THRESHOLDS } from '~/app/routes/$orgSlug/+components/pr-block'

import type { OpenPRInventoryAggregation } from '../+functions/aggregate'

// Same age scale as the Review Stacks blocks, in the same order as the
// aggregation's buckets.
const AGE_BUCKET_KEYS = [
  'daysUnder1',
  'days1to3',
  'days3to7',
  'days7to14',
  'days14to30',
  'days31Plus',
] as const

const chartConfig = Object.fromEntries(
  AGE_BUCKET_KEYS.map((key, i) => [
    key,
    { label: AGE_THRESHOLDS[i].label, theme: AGE_THRESHOLDS[i].chart },
  ]),
) satisfies ChartConfig

export function OpenPRInventoryChart({
  data,
}: {
  data: OpenPRInventoryAggregation
}) {
  const timezone = useTimezone()
  const { weeks } = data

  const hasAnyTotal = weeks.some((w) => w.total > 0)

  if (weeks.length === 0 || !hasAnyTotal) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Open PR inventory</CardTitle>
          <CardDescription>
            No open pull requests match the selected filters for this period.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Open PR inventory</CardTitle>
        <CardDescription>
          Stacked open PR counts by age (days open), measured at each week end
          (or now for the current week). Shows where review backlog builds up.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={chartConfig}
          style={{ height: 320, width: '100%' }}
        >
          <AreaChart data={weeks}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="weekLabel" tick={{ fontSize: 12 }} />
            <YAxis allowDecimals={false} />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(_, payload) => {
                    const snapshotAt = payload?.[0]?.payload?.snapshotAt as
                      | string
                      | undefined
                    return snapshotAt
                      ? `Week ending ${dayjs.utc(snapshotAt).tz(timezone).format('YYYY-MM-DD')}`
                      : ''
                  }}
                />
              }
            />
            <ChartLegend
              itemSorter={null}
              content={<ChartLegendContent className="flex-wrap" />}
            />
            {Object.keys(chartConfig).map((key) => (
              <Area
                key={key}
                type="linear"
                dataKey={key}
                stackId="inventory"
                fill={`var(--color-${key})`}
                stroke={`var(--color-${key})`}
              />
            ))}
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
