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

const chartConfig = {
  days0to3: { label: '0-3 days', color: 'var(--color-chart-2)' },
  days4to7: { label: '4-7 days', color: 'var(--color-chart-5)' },
  days8to14: { label: '8-14 days', color: 'var(--color-chart-1)' },
  days15to30: { label: '15-30 days', color: 'var(--color-chart-4)' },
  days31Plus: { label: '31+ days', color: 'var(--color-chart-3)' },
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
            <Area
              type="linear"
              dataKey="days0to3"
              stackId="inventory"
              fill="var(--color-days0to3)"
              stroke="var(--color-days0to3)"
            />
            <Area
              type="linear"
              dataKey="days4to7"
              stackId="inventory"
              fill="var(--color-days4to7)"
              stroke="var(--color-days4to7)"
            />
            <Area
              type="linear"
              dataKey="days8to14"
              stackId="inventory"
              fill="var(--color-days8to14)"
              stroke="var(--color-days8to14)"
            />
            <Area
              type="linear"
              dataKey="days15to30"
              stackId="inventory"
              fill="var(--color-days15to30)"
              stroke="var(--color-days15to30)"
            />
            <Area
              type="linear"
              dataKey="days31Plus"
              stackId="inventory"
              fill="var(--color-days31Plus)"
              stroke="var(--color-days31Plus)"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
