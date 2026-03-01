import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  XAxis,
  YAxis,
} from 'recharts'
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
import type { getReviewerQueueDistribution } from '../+functions/queries.server'

type QueueData = Awaited<ReturnType<typeof getReviewerQueueDistribution>>

const chartConfig = {
  queueCount: {
    label: 'Pending Reviews',
    color: 'hsl(var(--chart-1))',
  },
} satisfies ChartConfig

function getBarColor(count: number): string {
  if (count >= 5) return 'hsl(var(--destructive))'
  if (count >= 3) return 'hsl(var(--chart-4))'
  return 'hsl(var(--chart-2))'
}

export function ReviewerQueueChart({ data }: { data: QueueData }) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Review Queue by Reviewer</CardTitle>
          <CardDescription>
            No pending review requests for open PRs.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const chartData = data.map((d) => ({
    reviewer: d.displayName || d.reviewer,
    queueCount: d.queueCount,
  }))

  const chartHeight = Math.max(200, chartData.length * 40 + 60)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Review Queue by Reviewer</CardTitle>
        <CardDescription>
          Number of open PRs waiting for each reviewer. Imbalance here means
          some people are bottlenecks.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={chartConfig}
          style={{ height: chartHeight, width: '100%' }}
        >
          <BarChart data={chartData} layout="vertical" margin={{ left: 20 }}>
            <CartesianGrid horizontal={false} />
            <XAxis type="number" allowDecimals={false} />
            <YAxis
              dataKey="reviewer"
              type="category"
              width={120}
              tick={{ fontSize: 12 }}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="queueCount" radius={4}>
              {chartData.map((entry) => (
                <Cell
                  key={entry.reviewer}
                  fill={getBarColor(entry.queueCount)}
                />
              ))}
              <LabelList dataKey="queueCount" position="right" />
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
