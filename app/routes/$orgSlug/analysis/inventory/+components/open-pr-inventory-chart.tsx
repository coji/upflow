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

import type { OpenPRInventoryAggregation } from '../+functions/aggregate'

// Colors aligned with Review Stacks age thresholds
const chartConfig = {
  daysUnder1: { label: '< 1d', color: '#3b82f6' }, // blue-500
  days1to3: { label: '1-3d', color: '#10b981' }, // emerald-500
  days3to7: { label: '3-7d', color: '#f59e0b' }, // amber-500
  days7to14: { label: '7-14d', color: '#ef4444' }, // red-500
  days14to30: { label: '14-30d', color: '#a855f7' }, // purple-500
  days31Plus: { label: '31d+', color: '#262626' }, // neutral-800
} satisfies ChartConfig

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
