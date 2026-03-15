import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts'
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
  ChartTooltip,
  ChartTooltipContent,
} from '~/app/components/ui/chart'
import type { QueueTrendAggregation } from '../+functions/aggregate'

const chartConfig = {
  maxQueue: {
    label: 'Max',
    color: 'var(--color-chart-4)',
  },
  medianQueue: {
    label: 'Median',
    color: 'var(--color-chart-1)',
  },
} satisfies ChartConfig

export function QueueTrendChart({ data }: { data: QueueTrendAggregation }) {
  const { weeks, insight } = data

  if (weeks.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Review Queue Trend</CardTitle>
          <CardDescription>
            No review queue data available for the selected period.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Review Queue Trend</CardTitle>
        <CardDescription>
          Weekly max and median of daily pending review counts. Rising trends
          indicate growing reviewer bottlenecks.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={chartConfig}
          style={{ height: 300, width: '100%' }}
        >
          <LineChart data={weeks}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="weekLabel" tick={{ fontSize: 12 }} />
            <YAxis allowDecimals={false} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Line
              type="monotone"
              dataKey="maxQueue"
              stroke="var(--color-maxQueue)"
              strokeWidth={2}
              dot={{ r: 3 }}
            />
            <Line
              type="monotone"
              dataKey="medianQueue"
              stroke="var(--color-medianQueue)"
              strokeWidth={2}
              dot={{ r: 3 }}
            />
          </LineChart>
        </ChartContainer>
        {insight && (
          <p className="text-muted-foreground mt-2 text-center text-sm">
            {insight}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
